// DatingAppAPI.Controllers.UsersController.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DatingAppAPI.Data;
using DatingAppAPI.Models;
using DatingAppAPI.DTO;
using System.Security.Claims;
using DatingAppAPI.Helpers;
using Microsoft.AspNetCore.Authorization;
using System.IO; // Required for file operations

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly DatingAppDbContext _context;
        private readonly IWebHostEnvironment _hostingEnvironment; // To get wwwroot path
        private const int MaxPageSize = 50;
        private const int DefaultPageSize = 10;
        private readonly ILogger<UsersController> _logger;
        public UsersController(DatingAppDbContext context, IWebHostEnvironment hostingEnvironment, ILogger<UsersController> logger) // Inject ILogger
        {
            _context = context;
            _hostingEnvironment = hostingEnvironment;
            _logger = logger;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<UserCardDTO>>> GetUsersForSwiping(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = DefaultPageSize,
            [FromQuery] int? minAge = null,
            [FromQuery] int? maxAge = null,
            [FromQuery] double? currentLatitude = null,
            [FromQuery] double? currentLongitude = null,
            [FromQuery] int? maxDistanceKm = null, // Client có thể gửi giá trị lớn (ví dụ 500) để coi như "không giới hạn"
            [FromQuery] bool sortByCommonInterests = false)
        {
            if (pageSize > MaxPageSize) pageSize = MaxPageSize;
            if (pageSize <= 0) pageSize = DefaultPageSize;
            if (pageNumber <= 0) pageNumber = 1;

            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdClaim, out int loggedInUserId))
            {
                _logger.LogWarning("[GetUsersForSwiping] Could not get User ID from claims for request from {User}", User?.Identity?.Name ?? "Unknown User");
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID claim not found or invalid." });
            }

            var loggedInUser = await _context.Users
                                             .Include(u => u.UserInterests) // Để lấy sở thích của người dùng hiện tại
                                             .AsNoTracking()
                                             .FirstOrDefaultAsync(u => u.UserID == loggedInUserId);

            if (loggedInUser == null)
            {
                _logger.LogWarning("[GetUsersForSwiping] Logged in user with ID {UserId} not found in database.", loggedInUserId);
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User not found." });
            }

            _logger.LogInformation("[GetUsersForSwiping] User {UserId} requesting with filters: MinAge={MinAge}, MaxAge={MaxAge}, Lat={Lat}, Lon={Lon}, MaxDist={MaxDist}, SortByInterests={SortByInterests}",
                loggedInUserId, minAge, maxAge, currentLatitude, currentLongitude, maxDistanceKm, sortByCommonInterests);


            var swipedUserIds = await _context.Swipes
                .Where(s => s.FromUserID == loggedInUserId)
                .Select(s => s.ToUserID)
                .Distinct()
                .ToHashSetAsync(); // Dùng ToHashSetAsync để tối ưu việc kiểm tra Contains

            // --- XÂY DỰNG QUERY BAN ĐẦU ---
            IQueryable<User> usersQuery = _context.Users.AsNoTracking()
                .Where(u => u.UserID != loggedInUserId && u.IsEmailVerified == true); // Chỉ lấy user đã verify

            // Loại trừ những người đã được swipe
            if (swipedUserIds.Any())
            {
                usersQuery = usersQuery.Where(u => !swipedUserIds.Contains(u.UserID));
            }

            // --- ÁP DỤNG FILTER TRÊN DATABASE NẾU CÓ THỂ ---

            // 1. Filter theo Độ tuổi (có thể làm trên DB)
            if (minAge.HasValue || maxAge.HasValue)
            {
                var today = DateTime.Today;
                if (minAge.HasValue)
                {
                    // Users older than or equal to minAge means their birthdate is on or before (today - minAge years)
                    var maxBirthDateForMinAge = today.AddYears(-minAge.Value);
                    usersQuery = usersQuery.Where(u => u.Birthdate.HasValue && u.Birthdate.Value.Date <= maxBirthDateForMinAge.Date);
                }
                if (maxAge.HasValue)
                {
                    // Users younger than or equal to maxAge means their birthdate is on or after (today - (maxAge + 1) years + 1 day)
                    // Ví dụ: maxAge = 25. Hôm nay là 2023-01-01.
                    // Người sinh 1998-01-01 (25 tuổi) -> OK
                    // Người sinh 1997-12-31 (25 tuổi, sắp 26) -> OK
                    // Người sinh 1997-01-01 (26 tuổi) -> Loại
                    // Date must be >= today.AddYears(-(maxAge+1)).AddDays(1)
                    var minBirthDateForMaxAge = today.AddYears(-(maxAge.Value + 1)).AddDays(1);
                    usersQuery = usersQuery.Where(u => u.Birthdate.HasValue && u.Birthdate.Value.Date >= minBirthDateForMaxAge.Date);
                }
            }

            // Lấy tất cả user tiềm năng sau các filter cơ bản trên DB
            var allPotentialUsers = await usersQuery
                                        .Include(u => u.UserInterests) // Cần cho việc tính sở thích chung
                                            .ThenInclude(ui => ui.Interest) // Nếu bạn cần tên sở thích (không cần cho count)
                                        .ToListAsync();

            _logger.LogInformation("[GetUsersForSwiping] Found {Count} potential users after initial DB query for user {UserId}.", allPotentialUsers.Count, loggedInUserId);


            // --- FILTER VÀ SẮP XẾP TRONG BỘ NHỚ (IN-MEMORY) ---
            // Điều này cần thiết cho các tính toán phức tạp như khoảng cách và số sở thích chung
            // nếu không thể thực hiện hiệu quả trên DB.

            var loggedInUserInterestIds = loggedInUser.UserInterests.Select(ui => ui.InterestId).ToHashSet();

            var usersWithCalculatedData = allPotentialUsers.Select(u =>
            {
                double? distance = null;
                if (currentLatitude.HasValue && currentLongitude.HasValue && u.Latitude.HasValue && u.Longitude.HasValue)
                {
                    distance = LocationHelper.CalculateDistance(
                        currentLatitude.Value, currentLongitude.Value,
                        (double)u.Latitude.Value, (double)u.Longitude.Value
                    );
                }

                int commonInterestsCount = u.UserInterests.Count(ui => loggedInUserInterestIds.Contains(ui.InterestId));

                return new
                {
                    User = u,
                    Distance = distance,
                    CommonInterestsCount = commonInterestsCount,
                    Age = u.Birthdate.HasValue ? AgeCalculator.CalculateAge(u.Birthdate.Value) : (int?)null
                };
            }).AsEnumerable(); // Chuyển sang IEnumerable để filter in-memory

            // Filter theo khoảng cách tối đa
            if (maxDistanceKm.HasValue && currentLatitude.HasValue && currentLongitude.HasValue)
            {
                // Client có thể gửi một giá trị rất lớn (ví dụ: 500km hoặc 9999km) để biểu thị "không giới hạn"
                // hoặc frontend có thể không gửi maxDistanceKm nếu không muốn filter.
                // Giả sử nếu maxDistanceKm > 400 thì là không giới hạn (tùy bạn quyết định ngưỡng này)
                if (maxDistanceKm.Value < 400)
                {
                    usersWithCalculatedData = usersWithCalculatedData.Where(x => x.Distance.HasValue && x.Distance.Value <= maxDistanceKm.Value);
                }
            }

            // Sắp xếp
            if (sortByCommonInterests)
            {
                usersWithCalculatedData = usersWithCalculatedData
                    .OrderByDescending(x => x.CommonInterestsCount)
                    .ThenBy(x => x.Distance ?? double.MaxValue); // Users không có vị trí sẽ ở cuối
            }
            else if (currentLatitude.HasValue && currentLongitude.HasValue) // Mặc định sắp xếp theo khoảng cách nếu có vị trí
            {
                usersWithCalculatedData = usersWithCalculatedData
                    .OrderBy(x => x.Distance ?? double.MaxValue) // Gần nhất lên đầu
                    .ThenByDescending(x => x.CommonInterestsCount);
            }
            else // Nếu không có thông tin vị trí và không sort theo sở thích, có thể sort theo ID hoặc ngẫu nhiên
            {
                usersWithCalculatedData = usersWithCalculatedData.OrderBy(x => x.User.UserID); // Hoặc Guid.NewGuid() cho ngẫu nhiên
            }

            var finalFilteredAndSortedUsers = usersWithCalculatedData.ToList();
            _logger.LogInformation("[GetUsersForSwiping] Found {Count} users after in-memory filtering and sorting for user {UserId}.", finalFilteredAndSortedUsers.Count, loggedInUserId);


            // Áp dụng phân trang
            var paginatedUsers = finalFilteredAndSortedUsers
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => x.User) // Chỉ lấy lại User object
                .ToList();

            var usersToReturn = paginatedUsers.Select(u => new UserCardDTO
            {
                UserID = u.UserID,
                FullName = u.FullName,
                Avatar = u.Avatar,
                Age = u.Birthdate.HasValue ? AgeCalculator.CalculateAge(u.Birthdate.Value) : null
                // Bạn có thể muốn trả về cả Distance và CommonInterestsCount nếu FE cần hiển thị
            }).ToList();

            _logger.LogInformation("[GetUsersForSwiping] Returning {Count} users for page {PageNumber} for user {UserId}.", usersToReturn.Count, pageNumber, loggedInUserId);
            return Ok(usersToReturn);
        }


        // GET: api/Users/5
        [HttpGet("{id}/details")] // Thay đổi route ở đây
        [Authorize] // Nên authorize để bảo vệ thông tin user chi tiết
        public async Task<ActionResult<UserDetailDTO>> GetUserDetail(int id) // Trả về UserDetailDTO thay vì User model
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(currentUserIdClaim, out int loggedInUserId);


            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Photos)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .FirstOrDefaultAsync(u => u.UserID == id);

            if (user == null)
            {
                return NotFound();
            }

            // Map to UserDetailDTO
            var userDetailDto = new UserDetailDTO
            {
                UserID = user.UserID,
                Username = user.Username,
                FullName = user.FullName,
                Gender = user.Gender,
                Age = user.Birthdate.HasValue ? AgeCalculator.CalculateAge(user.Birthdate.Value) : null,
                Bio = user.Bio,
                Avatar = user.Avatar, // URL
                Address = user.Address, // Nếu bạn muốn hiển thị
                // Photos = user.Photos.Select(p => new PhotoDTO { PhotoID = p.PhotoID, PhotoURL = p.PhotoURL }).ToList(),
                Interests = user.UserInterests.Select(ui => new InterestDTO { InterestId = ui.InterestId, InterestName = ui.Interest.InterestName }).ToList(),
                // Thêm các trường khác nếu cần thiết cho màn hình profile chi tiết
            };

            if (loggedInUserId > 0 && loggedInUserId != id) // Chỉ tính nếu xem profile người khác và có loggedInUserId
            {
                var loggedInUserInfo = await _context.Users.AsNoTracking()
                                              .Select(u => new { u.UserID, u.Latitude, u.Longitude }) // Chỉ lấy các trường cần thiết
                                              .FirstOrDefaultAsync(u => u.UserID == loggedInUserId);

                if (loggedInUserInfo?.Latitude.HasValue == true && loggedInUserInfo?.Longitude.HasValue == true &&
                    user.Latitude.HasValue && user.Longitude.HasValue)
                {
                    userDetailDto.DistanceKm = LocationHelper.CalculateDistance(
                        (double)loggedInUserInfo.Latitude.Value, (double)loggedInUserInfo.Longitude.Value,
                        (double)user.Latitude.Value, (double)user.Longitude.Value
                    );
                }
            }

            return Ok(userDetailDto);
        }

        // GET: api/Users/5 - No change needed here for avatar URL logic
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users
                                     .AsNoTracking()
                                     .FirstOrDefaultAsync(u => u.UserID == id);

            if (user == null)
            {
                return NotFound();
            }
            user.Photos ??= new List<Photo>();
            user.SwipesMade ??= new List<Swipe>();
            user.SwipesReceived ??= new List<Swipe>();
            user.Matches1 ??= new List<Match>();
            user.Matches2 ??= new List<Match>();
            user.Messages ??= new List<Message>();
            user.UserInterests ??= new List<UserInterest>();
            return Ok(user);
        }

        // PUT: api/Users/5 - MODIFIED TO HANDLE FILE UPLOAD
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> PutUser(int id, [FromForm] UserUpdateDTO userUpdateDto, IFormFile? avatarFile)
        {
            // Authorization: Ensure the logged-in user is the one being updated or is an admin
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int loggedInUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID claim not found or invalid." });
            }

            if (loggedInUserId != id /* && !User.IsInRole("Admin") */)
            {
                return Forbid("You are not authorized to update this user's profile.");
            }

            var userEntityFromDb = await _context.Users.FirstOrDefaultAsync(u => u.UserID == id);
            if (userEntityFromDb == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = $"Không tìm thấy người dùng với ID {id}." });
            }

            // Update properties from DTO
            userEntityFromDb.FullName = userUpdateDto.FullName ?? userEntityFromDb.FullName;
            userEntityFromDb.Gender = userUpdateDto.Gender ?? userEntityFromDb.Gender;
            userEntityFromDb.Birthdate = userUpdateDto.Birthdate ?? userEntityFromDb.Birthdate;
            userEntityFromDb.Bio = userUpdateDto.Bio ?? userEntityFromDb.Bio;
            userEntityFromDb.PhoneNumber = userUpdateDto.PhoneNumber ?? userEntityFromDb.PhoneNumber;
            userEntityFromDb.Address = userUpdateDto.Address ?? userEntityFromDb.Address;
            userEntityFromDb.ProfileVisibility = userUpdateDto.ProfileVisibility ?? userEntityFromDb.ProfileVisibility;
            userEntityFromDb.Latitude = userUpdateDto.Latitude;
            userEntityFromDb.Longitude = userUpdateDto.Longitude;

            //if (userUpdateDto.Latitude.HasValue)
            //{
            //    userEntityFromDb.Latitude = userUpdateDto.Latitude.Value;
            //}
            //else if (userUpdateDto.GetType().GetProperty(nameof(UserUpdateDTO.Latitude)) != null && updates.ContainsKey(nameof(UserUpdateDTO.Latitude).ToLower())) // Kiểm tra xem client có chủ ý gửi null không
            //{
            //    userEntityFromDb.Latitude = null;
            //}


            //if (userUpdateDto.Longitude.HasValue)
            //{
            //    userEntityFromDb.Longitude = userUpdateDto.Longitude.Value;
            //}
            //else if (userUpdateDto.GetType().GetProperty(nameof(UserUpdateDTO.Longitude)) != null && updates.ContainsKey(nameof(UserUpdateDTO.Longitude).ToLower()))
            //{
            //    userEntityFromDb.Longitude = null;
            //}

            if (avatarFile != null && avatarFile.Length > 0)
            {
                var uploadsFolderPath = Path.Combine(_hostingEnvironment.WebRootPath, "images", "avatars");
                if (!Directory.Exists(uploadsFolderPath))
                {
                    Directory.CreateDirectory(uploadsFolderPath);
                }

                var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(avatarFile.FileName);
                var filePath = Path.Combine(uploadsFolderPath, uniqueFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await avatarFile.CopyToAsync(stream);
                }
                userEntityFromDb.Avatar = $"/images/avatars/{uniqueFileName}";
            }

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new
                {
                    userId = userEntityFromDb.UserID,
                    username = userEntityFromDb.Username,
                    email = userEntityFromDb.Email,
                    fullName = userEntityFromDb.FullName,
                    gender = userEntityFromDb.Gender,
                    birthdate = userEntityFromDb.Birthdate,
                    bio = userEntityFromDb.Bio,
                    avatar = userEntityFromDb.Avatar,
                    isEmailVerified = userEntityFromDb.IsEmailVerified // Đảm bảo trả về trường này
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                Console.WriteLine($"DbUpdateConcurrencyException khi cập nhật User ID {id}: {ex.Message}");
                if (!UserExists(id))
                {
                    return NotFound(new ProblemDetails { Title = "Không tìm thấy (Concurrency)", Detail = $"Người dùng với ID {id} có thể đã bị xóa." });
                }
                return StatusCode(StatusCodes.Status409Conflict, new ProblemDetails { Title = "Lỗi tương tranh", Detail = "Không thể lưu thay đổi do xung đột dữ liệu. Vui lòng thử lại." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Lỗi không xác định khi cập nhật User ID {id}: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Đã xảy ra lỗi không mong muốn khi xử lý yêu cầu của bạn." });
            }
        }

        // POST: api/Users - MODIFIED TO HANDLE FILE UPLOAD
        [HttpPost]
        [AllowAnonymous] // Or [Authorize] if registration requires being logged in (e.g. admin creating users)
        public async Task<ActionResult<User>> PostUser([FromForm] UserCreateDTO userCreateDto, IFormFile? avatarFile)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Check for existing username/email
            if (await _context.Users.AnyAsync(u => u.Username == userCreateDto.Username))
            {
                ModelState.AddModelError("Username", "Username already exists.");
                return BadRequest(new ValidationProblemDetails(ModelState));
            }
            if (!string.IsNullOrEmpty(userCreateDto.Email) && await _context.Users.AnyAsync(u => u.Email == userCreateDto.Email))
            {
                ModelState.AddModelError("Email", "Email already exists.");
                return BadRequest(new ValidationProblemDetails(ModelState));
            }

            var user = new User
            {
                Username = userCreateDto.Username,
                // HASH THE PASSWORD before storing it. Example using BCrypt.Net-Next:
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(userCreateDto.Password),
                FullName = userCreateDto.FullName,
                Gender = userCreateDto.Gender,
                Birthdate = userCreateDto.Birthdate,
                Bio = userCreateDto.Bio,
                PhoneNumber = userCreateDto.PhoneNumber,
                Email = userCreateDto.Email,
                Address = userCreateDto.Address,
                ProfileVisibility = userCreateDto.ProfileVisibility,
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = false, // Default for new users
                AccountStatus = (UserAccountStatus)1,       // Default to active, manage as needed
                // Initialize collections
                Photos = new List<Photo>(),
                SwipesMade = new List<Swipe>(),
                SwipesReceived = new List<Swipe>(),
                Matches1 = new List<Match>(),
                Matches2 = new List<Match>(),
                Messages = new List<Message>(),
                UserInterests = new List<UserInterest>()
            };

            if (avatarFile != null && avatarFile.Length > 0)
            {
                var uploadsFolderPath = Path.Combine(_hostingEnvironment.WebRootPath, "images", "avatars");
                if (!Directory.Exists(uploadsFolderPath))
                {
                    Directory.CreateDirectory(uploadsFolderPath);
                }

                var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(avatarFile.FileName);
                var filePath = Path.Combine(uploadsFolderPath, uniqueFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await avatarFile.CopyToAsync(stream);
                }
                user.Avatar = $"/images/avatars/{uniqueFileName}"; // Store relative URL
            }

            _context.Users.Add(user);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                Console.WriteLine($"Lỗi DbUpdateException khi tạo User: {ex.InnerException?.Message ?? ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Không thể tạo người dùng mới do lỗi cơ sở dữ liệu." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Lỗi khi tạo User: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Không thể tạo người dùng mới." });
            }

            // Return a DTO that doesn't expose PasswordHash, etc.
            // For now, returning the created user object (with ID).
            // Consider mapping to a UserGetDTO or similar.
            return CreatedAtAction(nameof(GetUser), new { id = user.UserID }, user);
        }

        // DELETE: api/Users/5 - No change needed here regarding avatar
        [HttpDelete("{id}")]
        [Authorize] // Typically only admins or the user themselves should delete
        public async Task<IActionResult> DeleteUser(int id)
        {
            // Add authorization: check if current user is 'id' or an admin
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int loggedInUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID claim not found or invalid." });
            }
            if (loggedInUserId != id /* && !User.IsInRole("Admin") */ )
            {
                return Forbid("You are not authorized to delete this user.");
            }


            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = $"Không tìm thấy người dùng với ID {id} để xóa." });
            }

            // TODO: Delete user's avatar file from wwwroot/images/avatars if it exists
            if (!string.IsNullOrEmpty(user.Avatar))
            {
                var avatarPath = Path.Combine(_hostingEnvironment.WebRootPath, user.Avatar.TrimStart('/'));
                if (System.IO.File.Exists(avatarPath))
                {
                    try
                    {
                        System.IO.File.Delete(avatarPath);
                    }
                    catch (IOException ex)
                    {
                        Console.WriteLine($"Error deleting avatar file {avatarPath}: {ex.Message}");
                        // Log error, but continue with user deletion
                    }
                }
            }

            _context.Users.Remove(user);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Lỗi khi xóa User ID {id}: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Không thể xóa người dùng." });
            }

            return NoContent();
        }

        private bool UserExists(int id)
        {
            return _context.Users.Any(e => e.UserID == id);
        }

        // GetUserByEmail - No changes needed here for avatar URL
        [HttpGet("by-email")]
        public async Task<ActionResult<User>> GetUserByEmail([FromQuery] string email)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = "Không tìm thấy người dùng với email cung cấp." });
            }
            user.Photos ??= new List<Photo>();
            user.SwipesMade ??= new List<Swipe>();
            user.UserInterests ??= new List<UserInterest>();
            return Ok(user);
        }

        // GetUserInterests - No changes needed
        [HttpGet("{userId}/interests")]
        public async Task<ActionResult<IEnumerable<InterestDTO>>> GetUserInterests(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound($"User with ID {userId} not found.");
            }

            var interests = await _context.UserInterests
                                          .Where(ui => ui.UserId == userId)
                                          .Include(ui => ui.Interest)
                                          .Select(ui => new InterestDTO
                                          {
                                              InterestId = ui.Interest.InterestId,
                                              InterestName = ui.Interest.InterestName
                                          })
                                          .AsNoTracking()
                                          .ToListAsync();
            return Ok(interests);
        }

        // UpdateUserInterests - No changes needed
        [HttpPost("{userId}/interests")]
        [Authorize]
        public async Task<IActionResult> UpdateUserInterests(int userId, [FromBody] List<int> interestIds)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int currentUserId))
            {
                return Unauthorized("User ID claim not found or invalid.");
            }

            if (userId != currentUserId /* && !User.IsInRole("Admin") */)
            {
                return Forbid("You can only update your own interests.");
            }

            var user = await _context.Users
                                     .Include(u => u.UserInterests)
                                     .FirstOrDefaultAsync(u => u.UserID == userId);

            if (user == null)
            {
                return NotFound($"User with ID {userId} not found.");
            }

            var validInterestIds = await _context.Interests
                                                 .Where(i => interestIds.Contains(i.InterestId))
                                                 .Select(i => i.InterestId)
                                                 .ToListAsync();

            var invalidIds = interestIds.Except(validInterestIds).ToList();
            if (invalidIds.Any())
            {
                return BadRequest($"Invalid Interest IDs: {string.Join(", ", invalidIds)}");
            }

            _context.UserInterests.RemoveRange(user.UserInterests);

            var newUserInterests = validInterestIds.Select(interestId => new UserInterest
            {
                UserId = userId,
                InterestId = interestId
            }).ToList();

            await _context.UserInterests.AddRangeAsync(newUserInterests);

            try
            {
                await _context.SaveChangesAsync();
                return Ok("User interests updated successfully.");
            }
            catch (DbUpdateException ex)
            {
                Console.WriteLine($"Error updating user interests: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError, "Error updating user interests: " + ex.Message);
            }
        }
    }
}