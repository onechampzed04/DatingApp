// File: Services/NotificationService.cs
using DatingAppAPI.Data;
using DatingAppAPI.DTO; // Cho NotificationDTO
using DatingAppAPI.Hubs; // Cho IChatClient và ChatHub
using DatingAppAPI.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace DatingAppAPI.Services
{
    public class NotificationService : INotificationService
    {
        private readonly DatingAppDbContext _context;
        private readonly IHubContext<ChatHub, IChatClient> _hubContext; // Sửa lại interface nếu bạn dùng NotificationHub riêng

        public NotificationService(DatingAppDbContext context, IHubContext<ChatHub, IChatClient> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task CreateAndSendNotificationAsync(
            int recipientUserId,
            NotificationType type,
            string messageText,
            int? senderUserId,
            int? referenceId,
            string? senderUsername = null, // For SignalR payload
            string? senderAvatar = null      // For SignalR payload
            )
        {
            // 1. Tạo và lưu notification vào DB
            var notification = new Notification
            {
                RecipientUserID = recipientUserId,
                Type = type,
                MessageText = messageText,
                SenderUserID = senderUserId,
                ReferenceID = referenceId,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.Notifications.Add(notification);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving notification to DB: {ex.Message}");
                // Có thể throw hoặc log và bỏ qua, tùy chiến lược
                return; // Không gửi SignalR nếu không lưu được DB
            }


            // 2. Chuẩn bị DTO để gửi qua SignalR (nếu cần, hoặc gửi luôn Model)
            // Lấy thêm thông tin sender nếu chưa được cung cấp
            if (senderUserId.HasValue && (string.IsNullOrEmpty(senderUsername) || string.IsNullOrEmpty(senderAvatar)))
            {
                var sender = await _context.Users
                                    .AsNoTracking()
                                    .Select(u => new { u.UserID, u.Username, u.FullName, u.Avatar })
                                    .FirstOrDefaultAsync(u => u.UserID == senderUserId.Value);
                if (sender != null)
                {
                    senderUsername ??= sender.FullName ?? sender.Username;
                    senderAvatar ??= sender.Avatar;
                }
            }


            var notificationDtoForSignalR = new NotificationDTO // Bạn cần tạo DTO này
            {
                NotificationID = notification.NotificationID.ToString(), // ID từ DB
                RecipientUserID = notification.RecipientUserID,
                NotificationType = (DatingAppAPI.DTO.NotificationTypeEnum)notification.Type, // Cần map enum
                MessageText = notification.MessageText,
                ReferenceID = notification.ReferenceID?.ToString(),
                SenderUserID = notification.SenderUserID,
                SenderUsername = senderUsername,
                SenderAvatar = senderAvatar,
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt
            };

            // 3. Gửi real-time notification qua SignalR
            var recipientConnections = ChatHub.GetConnectionsForUser(recipientUserId.ToString());
            if (recipientConnections.Any())
            {
                // Giả sử ChatHub có phương thức `ReceiveNotification` trong `IChatClient`
                await _hubContext.Clients.Clients(recipientConnections).ReceiveNotification(notificationDtoForSignalR);
                Console.WriteLine($"Sent SignalR notification to {recipientConnections.Count} connections for user {recipientUserId}");
            }
            else
            {
                Console.WriteLine($"No active SignalR connections for user {recipientUserId} to send notification.");
            }
        }
    }
}