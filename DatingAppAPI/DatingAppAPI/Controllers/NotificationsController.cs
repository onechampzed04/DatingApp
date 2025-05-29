// File: Controllers/NotificationController.cs
using DatingAppAPI.Data;
using DatingAppAPI.DTO;
using DatingAppAPI.Hubs; // Nếu cần gửi SignalR từ đây (ít khả năng)
using DatingAppAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
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
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly DatingAppDbContext _context;
        // private readonly IHubContext<ChatHub, IChatClient> _hubContext; // Chỉ cần nếu controller này cũng gửi SignalR

        public NotificationController(DatingAppDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                throw new UnauthorizedAccessException("User ID not found or invalid in token.");
            }
            return userId;
        }

        private ActionResult HandleUnauthorizedAccess()
        {
            return Unauthorized(new ProblemDetails { Title = "Unauthorized Access", Detail = "User ID claim not found or invalid." });
        }

        // GET: api/Notification
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDTO>>> GetNotification(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            if (pageNumber <= 0) pageNumber = 1;
            if (pageSize <= 0 || pageSize > 50) pageSize = 20;

            var NotificationQuery = _context.Notifications
                .Where(n => n.RecipientUserID == currentUserId)
                .Include(n => n.SenderUser) // Để lấy thông tin người gửi
                .AsNoTracking()
                .OrderByDescending(n => n.CreatedAt);

            var totalNotification = await NotificationQuery.CountAsync();
            var Notification = await NotificationQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var notificationDtos = Notification.Select(n => new NotificationDTO
            {
                NotificationID = n.NotificationID.ToString(),
                RecipientUserID = n.RecipientUserID,
                NotificationType = (DTO.NotificationTypeEnum)n.Type, // Nhớ cast enum
                MessageText = n.MessageText,
                ReferenceID = n.ReferenceID?.ToString(),
                SenderUserID = n.SenderUserID,
                SenderUsername = n.SenderUser?.FullName ?? n.SenderUser?.Username,
                SenderAvatar = n.SenderUser?.Avatar,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList();

            // Có thể thêm thông tin phân trang vào header hoặc response body
            // Response.Headers.Add("X-Pagination", Newtonsoft.Json.JsonConvert.SerializeObject(new { totalItems = totalNotification, pageSize, pageNumber, totalPages = (int)Math.Ceiling(totalNotification / (double)pageSize) }));

            return Ok(notificationDtos);
        }

        // POST: api/Notification/{notificationId}/read
        [HttpPost("{notificationId}/read")]
        public async Task<IActionResult> MarkNotificationAsRead(int notificationId)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.NotificationID == notificationId && n.RecipientUserID == currentUserId);

            if (notification == null)
            {
                return NotFound(new ProblemDetails { Title = "Notification Not Found", Detail = "Notification not found or you are not the recipient." });
            }

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }
            return NoContent(); // Thành công, không có nội dung trả về
        }

        // POST: api/Notification/read-all
        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllNotificationAsRead()
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var unreadNotification = await _context.Notifications
                .Where(n => n.RecipientUserID == currentUserId && !n.IsRead)
                .ToListAsync();

            if (unreadNotification.Any())
            {
                foreach (var notification in unreadNotification)
                {
                    notification.IsRead = true;
                }
                await _context.SaveChangesAsync();
            }
            return Ok(new { message = $"{unreadNotification.Count} Notification marked as read." });
        }
    }
}