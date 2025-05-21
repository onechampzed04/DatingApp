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
using DatingAppAPI.DTO; // Đảm bảo bạn có using này nếu dùng DTO khác, nhưng ở đây chúng ta dùng User model
using System.Security.Claims;

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly DatingAppDbContext _context;

        public UsersController(DatingAppDbContext context)
        {
            _context = context;
        }

        // GET: api/Users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            // Cân nhắc thêm .AsNoTracking() nếu đây là dữ liệu chỉ đọc
            return await _context.Users.AsNoTracking().ToListAsync();
        }

        // GET: api/Users/5
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            // Cân nhắc tải các navigation properties nếu client cần (ví dụ: .Include(u => u.Photos))
            // Và dùng .AsNoTracking() nếu dữ liệu chỉ đọc sau khi trả về
            var user = await _context.Users
                                     // .Include(u => u.Photos) // Ví dụ
                                     // .Include(u => u.UserInterests).ThenInclude(ui => ui.Interest) // Ví dụ
                                     .AsNoTracking() // Quan trọng nếu không cập nhật ngay sau đó trong cùng scope
                                     .FirstOrDefaultAsync(u => u.UserID == id);

            if (user == null)
            {
                return NotFound();
            }

            // Khởi tạo các collection nếu chúng là null TRƯỚC KHI trả về cho client,
            // nếu client mong đợi luôn có mảng rỗng thay vì null.
            // Điều này giúp client dễ dàng làm việc với dữ liệu hơn.
            user.Photos ??= new List<Photo>();
            user.SwipesMade ??= new List<Swipe>();
            user.SwipesReceived ??= new List<Swipe>();
            user.Matches1 ??= new List<Match>();
            user.Matches2 ??= new List<Match>();
            user.Messages ??= new List<Message>();
            user.UserInterests ??= new List<UserInterest>();


            return Ok(user); // Trả về Ok(user) thay vì chỉ user để có thể set AsNoTracking
        }

        // PUT: api/Users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, [FromBody] User userFromRequest)
        {
            if (id != userFromRequest.UserID)
            {
                // Thêm message cụ thể cho BadRequest
                return BadRequest(new ProblemDetails { Title = "ID không khớp", Detail = "ID trong URL không khớp với UserID trong body của request." });
            }

            // Tải entity hiện tại từ database ĐỂ CẬP NHẬT (không dùng AsNoTracking ở đây)
            var userEntityFromDb = await _context.Users.FirstOrDefaultAsync(u => u.UserID == id);

            if (userEntityFromDb == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = $"Không tìm thấy người dùng với ID {id}." });
            }

            // Cập nhật các thuộc tính của userEntityFromDb với giá trị từ userFromRequest
            // Chỉ cập nhật những trường bạn cho phép client thay đổi qua endpoint này.
            // Client gửi gì, trường đó sẽ được cập nhật, kể cả khi giá trị gửi là null (cho các kiểu nullable).

            // Ví dụ cập nhật các trường cơ bản cho profile:
            userEntityFromDb.FullName = userFromRequest.FullName;
            userEntityFromDb.Gender = userFromRequest.Gender;
            userEntityFromDb.Birthdate = userFromRequest.Birthdate;
            userEntityFromDb.Bio = userFromRequest.Bio;
            userEntityFromDb.Avatar = userFromRequest.Avatar;
            userEntityFromDb.PhoneNumber = userFromRequest.PhoneNumber;
            userEntityFromDb.Address = userFromRequest.Address;
            userEntityFromDb.ProfileVisibility = userFromRequest.ProfileVisibility;

            // Các trường nhạy cảm như Email, Username, PasswordHash, IsEmailVerified, AccountStatus
            // KHÔNG NÊN được cập nhật một cách mù quáng qua một endpoint PUT chung chung như thế này.
            // Chúng nên có quy trình hoặc endpoint riêng với logic nghiệp vụ phù hợp (ví dụ: xác minh email khi đổi email).
            // userEntityFromDb.Email = userFromRequest.Email; // CẨN THẬN!
            // userEntityFromDb.Username = userFromRequest.Username; // CẨN THẬN!

            // Đối với các COLLECTION (Photos, UserInterests, Matches, etc.):
            // Theo Cách 2, chúng ta sẽ KHÔNG cập nhật các collection này trực tiếp
            // trong endpoint PUT chung này trừ khi có yêu cầu cụ thể.
            // Lý do:
            // 1. Client (trong kịch bản setup profile người dùng mới) có thể gửi các collection này là null
            //    hoặc không gửi. Chúng ta không muốn gây lỗi validation.
            // 2. Việc cập nhật collection (thêm, xóa, sửa item) thường phức tạp hơn
            //    và nên có endpoint riêng (ví dụ: POST /api/users/{id}/photos, DELETE /api/users/{id}/interests/{interestId}).
            // Bằng cách không gán lại userFromRequest.Photos cho userEntityFromDb.Photos,
            // EF Core sẽ không coi đây là một sự thay đổi cho collection đó (trừ khi bạn load nó và thay đổi items bên trong).
            // Các collection sẽ giữ nguyên giá trị của chúng trong database.

            // Sau khi đã gán các giá trị mới vào userEntityFromDb,
            // EF Core sẽ tự động theo dõi các thay đổi này khi bạn gọi SaveChangesAsync.
            // Không nhất thiết phải gọi _context.Entry(userEntityFromDb).State = EntityState.Modified;
            // trừ khi có trường hợp đặc biệt mà EF Core không theo dõi được.

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Ghi log lỗi chi tiết
                Console.WriteLine($"DbUpdateConcurrencyException khi cập nhật User ID {id}: {ex.Message}");
                if (!UserExists(id))
                {
                    return NotFound(new ProblemDetails { Title = "Không tìm thấy (Concurrency)", Detail = $"Người dùng với ID {id} có thể đã bị xóa." });
                }
                else
                {
                    // Lỗi tương tranh không giải quyết được, trả về lỗi server
                    return StatusCode(StatusCodes.Status409Conflict, new ProblemDetails { Title = "Lỗi tương tranh", Detail = "Không thể lưu thay đổi do xung đột dữ liệu. Vui lòng thử lại." });
                }
            }
            catch (Exception ex)
            {
                // Ghi log lỗi chung chi tiết
                Console.WriteLine($"Lỗi không xác định khi cập nhật User ID {id}: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Đã xảy ra lỗi không mong muốn khi xử lý yêu cầu của bạn." });
            }

            return NoContent(); // HTTP 204 No Content là phản hồi chuẩn cho PUT thành công không trả về body
        }

        // POST: api/Users
        [HttpPost]
        public async Task<ActionResult<User>> PostUser([FromBody] User user) // Nên sử dụng một DTO cho việc tạo User
        {
            // Validate dữ liệu đầu vào ở đây nếu cần (ví dụ: username/email đã tồn tại chưa)
            // Hash password trước khi lưu
            // user.PasswordHash = YourPasswordHasher.Hash(user.PasswordHash); // PasswordHash nên là password thô từ client
            // Nên dùng một UserCreateDTO ở đây thay vì User model trực tiếp

            // Khởi tạo các collection nếu chúng là null từ request để tránh lỗi khi SaveChangesAsync
            // nếu DB không cho phép null cho các foreign key trỏ tới chúng (ít khả năng cho collection).
            // Hoặc dựa vào việc khởi tạo trong model User.
            user.Photos ??= new List<Photo>();
            user.SwipesMade ??= new List<Swipe>();
            user.SwipesReceived ??= new List<Swipe>();
            user.Matches1 ??= new List<Match>();
            user.Matches2 ??= new List<Match>();
            user.Messages ??= new List<Message>();
            user.UserInterests ??= new List<UserInterest>();
            user.CreatedAt = DateTime.UtcNow; // Đảm bảo CreatedAt được đặt


            _context.Users.Add(user);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Lỗi khi tạo User: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Lỗi máy chủ", Detail = "Không thể tạo người dùng mới." });
            }

            // Trả về CreatedAtAction với User đã được tạo (đã có ID)
            return CreatedAtAction(nameof(GetUser), new { id = user.UserID }, user);
        }

        // DELETE: api/Users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = $"Không tìm thấy người dùng với ID {id} để xóa." });
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

        [HttpGet("by-email")]
        public async Task<ActionResult<User>> GetUserByEmail([FromQuery] string email)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                return NotFound(new ProblemDetails { Title = "Không tìm thấy", Detail = "Không tìm thấy người dùng với email cung cấp." });
            }
            // Khởi tạo các collection trước khi trả về, tương tự GetUser(id)
            user.Photos ??= new List<Photo>();
            user.SwipesMade ??= new List<Swipe>();
            // ... (các collection khác)
            user.UserInterests ??= new List<UserInterest>();

            return Ok(user);
        }

        // GET: api/Users/{userId}/interests (Đã có)
        [HttpGet("{userId}/interests")]
        public async Task<ActionResult<IEnumerable<InterestDTO>>> GetUserInterests(int userId)
        {
            var user = await _context.Users.FindAsync(userId); // Hoặc FirstOrDefaultAsync
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
                                          .AsNoTracking() // Dữ liệu chỉ đọc
                                          .ToListAsync();

            return Ok(interests);
        }

        [HttpPost("{userId}/interests")]
        public async Task<IActionResult> UpdateUserInterests(int userId, [FromBody] List<int> interestIds)
        {
            // Lấy UserID của người dùng đang đăng nhập từ token
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int currentUserId))
            {
                return Unauthorized("User ID claim not found or invalid.");
            }

            // Kiểm tra xem người dùng có đang cố cập nhật sở thích của chính mình không
            // (Hoặc bạn có thể cho phép admin cập nhật cho người khác)
            if (userId != currentUserId)
            {
                // Nếu bạn muốn chỉ cho phép người dùng tự cập nhật:
                return Forbid("You can only update your own interests.");
                // Nếu bạn muốn admin có thể cập nhật, bạn cần thêm logic kiểm tra role admin ở đây.
            }

            var user = await _context.Users
                                     .Include(u => u.UserInterests) // Nạp các sở thích hiện tại
                                     .FirstOrDefaultAsync(u => u.UserID == userId);

            if (user == null)
            {
                return NotFound($"User with ID {userId} not found.");
            }

            // Kiểm tra xem các InterestID gửi lên có hợp lệ không
            var validInterestIds = await _context.Interests
                                                 .Where(i => interestIds.Contains(i.InterestId))
                                                 .Select(i => i.InterestId)
                                                 .ToListAsync();

            var invalidIds = interestIds.Except(validInterestIds).ToList();
            if (invalidIds.Any())
            {
                return BadRequest($"Invalid Interest IDs: {string.Join(", ", invalidIds)}");
            }

            // Xóa các sở thích cũ của người dùng
            _context.UserInterests.RemoveRange(user.UserInterests);

            // Thêm các sở thích mới
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
                // Hoặc trả về danh sách sở thích mới
                // return Ok(newUserInterests.Select(ui => new { ui.UserId, ui.InterestId }));
            }
            catch (DbUpdateException ex)
            {
                // Log lỗi
                return StatusCode(StatusCodes.Status500InternalServerError, "Error updating user interests: " + ex.Message);
            }
        }
    }
}
