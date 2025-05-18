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
            return await _context.Users.ToListAsync();
        }

        // GET: api/Users/5
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound();
            }

            return user;
        }

        // PUT: api/Users/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, User user)
        {
            if (id != user.UserID)
            {
                return BadRequest();
            }

            _context.Entry(user).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UserExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Users
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<User>> PostUser(User user)
        {
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetUser", new { id = user.UserID }, user);
        }

        // DELETE: api/Users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool UserExists(int id)
        {
            return _context.Users.Any(e => e.UserID == id);
        }

        [HttpGet("by-email")]
        public async Task<ActionResult<User>> GetUserByEmail([FromQuery] string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                return NotFound();
            }

            return user;
        }

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
                                          .Include(ui => ui.Interest) // Nạp thông tin Interest
                                          .Select(ui => new InterestDTO // Sử dụng DTO để trả về dữ liệu gọn gàng
                                          {
                                              InterestId = ui.Interest.InterestId,
                                              InterestName = ui.Interest.InterestName
                                          })
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
