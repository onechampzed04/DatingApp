// File: Services/INotificationService.cs
using DatingAppAPI.Models;
using System.Threading.Tasks;

namespace DatingAppAPI.Services
{
    public interface INotificationService
    {
        Task CreateAndSendNotificationAsync(
            int recipientUserId,
            NotificationType type,
            string messageText,
            int? senderUserId,
            int? referenceId,
            string? senderUsername = null, // Thêm các tham số tùy chọn để làm giàu thông báo cho SignalR
            string? senderAvatar = null
        );
    }
}