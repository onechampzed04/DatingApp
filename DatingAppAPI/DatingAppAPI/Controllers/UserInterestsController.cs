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

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserInterestsController : ControllerBase
    {
        private readonly DatingAppDbContext _context;

        public UserInterestsController(DatingAppDbContext context)
        {
            _context = context;
        }

        // GET: api/UserInterests
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserInterest>>> GetUserInterests()
        {
            return await _context.UserInterests.ToListAsync();
        }

        // GET: api/UserInterests/5
        [HttpGet("{id}")]
        public async Task<ActionResult<UserInterest>> GetUserInterest(int id)
        {
            var userInterest = await _context.UserInterests.FindAsync(id);

            if (userInterest == null)
            {
                return NotFound();
            }

            return userInterest;
        }

        // PUT: api/UserInterests/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUserInterest(int id, UserInterest userInterest)
        {
            if (id != userInterest.UserId)
            {
                return BadRequest();
            }

            _context.Entry(userInterest).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UserInterestExists(id))
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

        // POST: api/UserInterests
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<UserInterest>> PostUserInterest(UserInterest userInterest)
        {
            _context.UserInterests.Add(userInterest);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                if (UserInterestExists(userInterest.UserId))
                {
                    return Conflict();
                }
                else
                {
                    throw;
                }
            }

            return CreatedAtAction("GetUserInterest", new { id = userInterest.UserId }, userInterest);
        }

        // DELETE: api/UserInterests/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUserInterest(int id)
        {
            var userInterest = await _context.UserInterests.FindAsync(id);
            if (userInterest == null)
            {
                return NotFound();
            }

            _context.UserInterests.Remove(userInterest);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool UserInterestExists(int id)
        {
            return _context.UserInterests.Any(e => e.UserId == id);
        }
        
        [HttpPost("SaveUserInterests")]
        public async Task<IActionResult> SaveUserInterests(UserInterestDTO userInterestDto)
        {
            // Kiểm tra xem User có tồn tại không
            var user = await _context.Users.FindAsync(userInterestDto.UserId);
            if (user == null)
            {
                return NotFound("User not found.");
            }

            // Xóa các UserInterest cũ của User (nếu cần)
            var existingUserInterests = _context.UserInterests
                .Where(ui => ui.UserId == userInterestDto.UserId);
            _context.UserInterests.RemoveRange(existingUserInterests);

            // Thêm các UserInterest mới
            var newUserInterests = userInterestDto.InterestIds.Select(interestId => new UserInterest
            {
                UserId = userInterestDto.UserId,
                InterestId = interestId
            });

            await _context.UserInterests.AddRangeAsync(newUserInterests);
            await _context.SaveChangesAsync();

            return Ok("User interests updated successfully.");
        }
    }
}
