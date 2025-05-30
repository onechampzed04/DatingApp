﻿using DatingAppAPI.Data;
using DatingAppAPI.DTO;
using DatingAppAPI.Helpers;
using DatingAppAPI.Models;
using DatingAppAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SwipesController : ControllerBase
    {
        private readonly DatingAppDbContext _context;
        private readonly INotificationService _notificationService; // << THÊM FIELD

        public SwipesController(DatingAppDbContext context, INotificationService notificationService)
        {
            _context = context;
            _notificationService = notificationService; // << GÁN
        }
        // GET: api/Swipes (Có thể giữ lại để debug hoặc cho admin, nhưng không cần thiết cho client)
        [HttpGet]
        [AllowAnonymous] // Ví dụ: Cho phép truy cập không cần token để test
        public async Task<ActionResult<IEnumerable<Swipe>>> GetSwipes()
        {
            return await _context.Swipes.ToListAsync();
        }


        // POST: api/Swipes
        // Endpoint chính để xử lý hành động swipe
        [HttpPost("createswipe")]
        [Authorize]
        public async Task<IActionResult> CreateSwipe([FromBody] SwipeCreateDTO swipeDto)
        {
            var fromUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Match? createdMatch = null; // <<< KHAI BÁO createdMatch ở đây, cho phép null

            if (fromUserIdClaim == null || !int.TryParse(fromUserIdClaim, out int fromUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID không hợp lệ từ token." });
            }

            if (fromUserId == swipeDto.ToUserID)
            {
                return BadRequest(new ProblemDetails { Title = "Invalid Swipe", Detail = "Bạn không thể swipe chính mình." });
            }

            var toUserExists = await _context.Users.AnyAsync(u => u.UserID == swipeDto.ToUserID);
            if (!toUserExists)
            {
                return NotFound(new ProblemDetails { Title = "User Not Found", Detail = $"Không tìm thấy người dùng với ID {swipeDto.ToUserID}." });
            }

            var existingSwipe = await _context.Swipes
                .FirstOrDefaultAsync(s => s.FromUserID == fromUserId && s.ToUserID == swipeDto.ToUserID);

            bool isNewMatch = false;
            // Tạo một DTO hoặc anonymous type để chứa thông tin chi tiết của matched user
            object? matchedUserDetails = null;

            if (existingSwipe != null)
            {
                if (existingSwipe.IsLike != swipeDto.IsLike)
                {
                    existingSwipe.IsLike = swipeDto.IsLike;
                    existingSwipe.SwipeTime = DateTime.UtcNow;
                    _context.Swipes.Update(existingSwipe);
                }
            }
            else
            {
                var newSwipe = new Swipe
                {
                    FromUserID = fromUserId,
                    ToUserID = swipeDto.ToUserID,
                    IsLike = swipeDto.IsLike,
                    SwipeTime = DateTime.UtcNow
                };
                await _context.Swipes.AddAsync(newSwipe);
            }

            if (swipeDto.IsLike)
            {
                var otherUserLikesMe = await _context.Swipes
                    .AnyAsync(s => s.FromUserID == swipeDto.ToUserID && s.ToUserID == fromUserId && s.IsLike);

                if (otherUserLikesMe)
                {
                    var existingMatch = await _context.Matches
                        .FirstOrDefaultAsync(m =>
                            (m.User1ID == fromUserId && m.User2ID == swipeDto.ToUserID) ||
                            (m.User1ID == swipeDto.ToUserID && m.User2ID == fromUserId));

                    if (existingMatch == null)
                    {
                        var tempNewMatch = new Match // Sử dụng biến tạm để tránh lỗi "use of unassigned local variable"
                        {
                            User1ID = fromUserId,
                            User2ID = swipeDto.ToUserID,
                            MatchTime = DateTime.UtcNow,
                            Messages = new List<Message>()
                        };
                        await _context.Matches.AddAsync(tempNewMatch);
                        // Gán cho biến ngoài scope sau khi add vào context nhưng TRƯỚC SaveChangesAsync
                        // để có thể lấy ID sau khi SaveChangesAsync nếu cần (EF Core sẽ tự gán ID)
                        createdMatch = tempNewMatch; // <<< GÁN GIÁ TRỊ CHO createdMatch
                        isNewMatch = true;

                        // Lấy thông tin chi tiết của người vừa match, bao gồm Birthdate
                        var matchedUserFromDb = await _context.Users
                                    .AsNoTracking()
                                    .Select(u => new
                                    {
                                        u.UserID,
                                        u.FullName,
                                        u.Avatar, // This will be the URL
                                        u.Birthdate
                                    })
                                    .FirstOrDefaultAsync(u => u.UserID == swipeDto.ToUserID);

                        if (matchedUserFromDb != null)
                        {
                            matchedUserDetails = new MatchedUserDetailsDTO
                            {
                                UserId = matchedUserFromDb.UserID,
                                FullName = matchedUserFromDb.FullName,
                                Avatar = matchedUserFromDb.Avatar, // Correctly uses the Avatar URL
                                Age = AgeCalculator.CalculateAge(matchedUserFromDb.Birthdate)
                            };
                        }
                    }
                }
            }
            else if (existingSwipe != null && existingSwipe.IsLike && !swipeDto.IsLike)
            {
                var matchToDelete = await _context.Matches
                    .FirstOrDefaultAsync(m =>
                        (m.User1ID == fromUserId && m.User2ID == swipeDto.ToUserID) ||
                        (m.User1ID == swipeDto.ToUserID && m.User2ID == fromUserId));
                if (matchToDelete != null)
                {
                    _context.Matches.Remove(matchToDelete);
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                Console.WriteLine($"Error saving swipe/match: {ex.ToString()}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Database Error", Detail = "Lỗi khi lưu dữ liệu swipe hoặc match." });
            }

            if (isNewMatch && matchedUserDetails != null && createdMatch != null) // <<< THÊM KIỂM TRA createdMatch != null
            {
                var fromUser = await _context.Users
                                    .AsNoTracking()
                                    .Select(u => new { u.UserID, u.FullName, u.Username, u.Avatar })
                                    .FirstOrDefaultAsync(u => u.UserID == fromUserId);

                if (fromUser != null)
                {
                    string messageToMatchedUser = $"{fromUser.FullName ?? fromUser.Username} đã tương hợp với bạn!";
                    await _notificationService.CreateAndSendNotificationAsync(
                        recipientUserId: swipeDto.ToUserID,
                        type: NotificationType.NewMatch,
                        messageText: messageToMatchedUser,
                        senderUserId: fromUserId,
                        referenceId: createdMatch.MatchID, // <<< SỬ DỤNG createdMatch.MatchID
                        senderUsername: fromUser.FullName ?? fromUser.Username,
                        senderAvatar: fromUser.Avatar
                    );

                    var matchedUserDto = (MatchedUserDetailsDTO)matchedUserDetails;
                    string messageToSwiper = $"Bạn đã tương hợp với {matchedUserDto.FullName}!";
                    await _notificationService.CreateAndSendNotificationAsync(
                        recipientUserId: fromUserId,
                        type: NotificationType.NewMatch,
                        messageText: messageToSwiper,
                        senderUserId: swipeDto.ToUserID,
                        referenceId: createdMatch.MatchID, // <<< SỬ DỤNG createdMatch.MatchID
                        senderUsername: matchedUserDto.FullName,
                        senderAvatar: matchedUserDto.Avatar
                    );
                }

                return Ok(new SwipeMatchResponseDTO
                {
                    Message = "It's a Match!",
                    IsMatch = true,
                    MatchedWithUser = (MatchedUserDetailsDTO)matchedUserDetails
                });
            }

            return Ok(new SwipeMatchResponseDTO { Message = "Swipe processed successfully.", IsMatch = false, MatchedWithUser = null });
        }

        // GET: api/Swipes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Swipe>> GetSwipe(int id)
        {
            var swipe = await _context.Swipes.FindAsync(id);

            if (swipe == null)
            {
                return NotFound();
            }

            return swipe;
        }

        // PUT: api/Swipes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSwipe(int id, Swipe swipe)
        {
            if (id != swipe.SwipeID)
            {
                return BadRequest();
            }

            _context.Entry(swipe).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SwipeExists(id))
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

        // POST: api/Swipes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost("postswipe")]
        public async Task<ActionResult<Swipe>> PostSwipe(Swipe swipe)
        {
            _context.Swipes.Add(swipe);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSwipe", new { id = swipe.SwipeID }, swipe);
        }

        // DELETE: api/Swipes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSwipe(int id)
        {
            var swipe = await _context.Swipes.FindAsync(id);
            if (swipe == null)
            {
                return NotFound();
            }

            _context.Swipes.Remove(swipe);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SwipeExists(int id)
        {
            return _context.Swipes.Any(e => e.SwipeID == id);
        }
    }
}
