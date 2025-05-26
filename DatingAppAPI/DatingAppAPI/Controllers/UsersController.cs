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

        public UsersController(DatingAppDbContext context, IWebHostEnvironment hostingEnvironment)
        {
            _context = context;
            _hostingEnvironment = hostingEnvironment; // Inject IWebHostEnvironment
        }

        // GET: api/Users (GetUsersForSwiping)
        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<UserCardDTO>>> GetUsersForSwiping(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = DefaultPageSize)
        {
            if (pageSize > MaxPageSize) pageSize = MaxPageSize;
            if (pageSize <= 0) pageSize = DefaultPageSize;
            if (pageNumber <= 0) pageNumber = 1;

            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? loggedInUserId = null;
            if (currentUserIdClaim != null && int.TryParse(currentUserIdClaim, out int parsedUserId))
            {
                loggedInUserId = parsedUserId;
            }
            else
            {
                Console.WriteLine("[DEBUG GetUsersForSwiping] Could not get User ID from claims.");
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID claim not found or invalid." });
            }

            // Lấy danh sách các UserID mà người dùng hiện tại đã swipe
            var swipedUserIds = await _context.Swipes
                .Where(s => s.FromUserID == loggedInUserId.Value)
                .Select(s => s.ToUserID)
                .Distinct() // Chỉ lấy các ID duy nhất
                .ToListAsync(); // Lấy danh sách này về client (API server)

            var usersQuery = _context.Users.AsNoTracking()
                .Where(u => u.UserID != loggedInUserId.Value); // Loại trừ chính mình

            // Loại trừ những người đã được swipe
            if (swipedUserIds.Any())
            {
                usersQuery = usersQuery.Where(u => !swipedUserIds.Contains(u.UserID));
            }

            // (Tùy chọn) Thêm các bộ lọc khác nếu cần (ví dụ: theo giới tính ưa thích, độ tuổi, khoảng cách)
            // usersQuery = usersQuery.Where(u => u.Gender == preference.Gender && ...);

            var totalPotentialUsers = await usersQuery.CountAsync(); // Đếm sau khi áp dụng tất cả các bộ lọc
            Console.WriteLine($"[DEBUG GetUsersForSwiping] User {loggedInUserId.Value}: Total potential users to swipe (after excluding self and swiped): {totalPotentialUsers} for page {pageNumber}, pageSize {pageSize}");

            var usersToReturn = await usersQuery
                .OrderBy(u => u.UserID) // Hoặc OrderBy ngẫu nhiên: .OrderBy(u => Guid.NewGuid())
                                        // Tuy nhiên, OrderBy(u => u.UserID) ổn định hơn cho phân trang
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new UserCardDTO
                {
                    UserID = u.UserID,
                    FullName = u.FullName,
                    Avatar = u.Avatar,
                    Age = AgeCalculator.CalculateAge(u.Birthdate)
                })
                .ToListAsync();

            Console.WriteLine($"[DEBUG GetUsersForSwiping] Returning {usersToReturn.Count} users for page {pageNumber}.");
            return Ok(usersToReturn);
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
                AccountStatus = 1,       // Default to active, manage as needed
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