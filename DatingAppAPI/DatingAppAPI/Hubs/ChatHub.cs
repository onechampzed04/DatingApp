// File: Hubs/ChatHub.cs
using DatingAppAPI.Data;
using DatingAppAPI.DTO; // << Đảm bảo namespace DTO đúng
using DatingAppAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DatingAppAPI.Hubs // << Đảm bảo namespace Hubs đúng
{
    public interface IChatClient
    {
        Task ReceiveMessage(MessageDTO message);
        Task MessagesReadNotification(int matchId, int readerUserId, List<int> messageIds); // Thông báo message nào đã được đọc bởi ai
        Task NotifyTyping(int matchId, int typingUserId, string userName);
        Task NotifyStoppedTyping(int matchId, int typingUserId);
        Task UserStatusChanged(int userId, bool isOnline, DateTimeOffset? lastSeen); // << THÊM METHOD MỚI

    }

    [Authorize]
    public class ChatHub : Hub<IChatClient>
    {
        private readonly DatingAppDbContext _context; // << THÊM TRƯỜNG NÀY

        private readonly IHubContext<ChatHub, IChatClient> _globalHubContext; // Để gọi từ bên ngoài Hub

        // << THÊM CONSTRUCTOR NÀY
        public ChatHub(DatingAppDbContext context, IHubContext<ChatHub, IChatClient> globalHubContext) // Thêm globalHubContext
        {
            _context = context;
            _globalHubContext = globalHubContext;
        }

        private static readonly ConcurrentDictionary<string, List<string>> UserConnectionsMap = new ConcurrentDictionary<string, List<string>>();

        public override async Task OnConnectedAsync()
        {
            var userIdStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out int userId))
            {
                var connectionId = Context.ConnectionId;
                UserConnectionsMap.AddOrUpdate(userIdStr,
                    _ => new List<string> { connectionId },
                    (_, list) => { lock (list) { if (!list.Contains(connectionId)) list.Add(connectionId); } return list; });
                Console.WriteLine($"[ChatHub] User {userIdStr} connected with ID {connectionId}");

                // Cập nhật trạng thái user trong DB và thông báo
                await UpdateUserOnlineStatus(userId, true);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userIdStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out int userId))
            {
                if (UserConnectionsMap.TryGetValue(userIdStr, out var connectionIds))
                {
                    bool shouldMarkOffline = false;
                    lock (connectionIds)
                    {
                        connectionIds.Remove(Context.ConnectionId);
                        if (connectionIds.Count == 0)
                        {
                            UserConnectionsMap.TryRemove(userIdStr, out _);
                            shouldMarkOffline = true; // Chỉ đánh dấu offline nếu đây là connection cuối cùng
                        }
                    }
                    Console.WriteLine($"[ChatHub] User {userIdStr} disconnected ID {Context.ConnectionId}. Remaining connections: {(connectionIds != null && connectionIds.Any() ? string.Join(", ", connectionIds) : "None")}");

                    if (shouldMarkOffline)
                    {
                        // Cập nhật trạng thái user trong DB và thông báo
                        await UpdateUserOnlineStatus(userId, false);
                    }
                }
            }
            await base.OnDisconnectedAsync(exception);
        }
        private async Task UpdateUserOnlineStatus(int userId, bool isOnline)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user != null)
            {
                user.AccountStatus = isOnline ? UserAccountStatus.Online : UserAccountStatus.Offline; // Hoặc (int)(isOnline ? UserAccountStatus.Online : UserAccountStatus.Offline)
                user.LastLoginDate = DateTimeOffset.UtcNow; // Luôn cập nhật LastLoginDate
                try
                {
                    await _context.SaveChangesAsync();
                    Console.WriteLine($"[ChatHub] User {userId} status updated to {(isOnline ? "Online" : "Offline")}, LastLogin: {user.LastLoginDate}");

                    // Thông báo cho các client khác về sự thay đổi trạng thái
                    // Cần lấy danh sách những user "quan tâm" đến user này (ví dụ: bạn bè, người đã match)
                    // Ví dụ đơn giản: thông báo cho tất cả user đang kết nối (có thể không tối ưu cho app lớn)
                    // await Clients.All.UserStatusChanged(userId, isOnline, isOnline ? (DateTimeOffset?)null : user.LastLoginDate);

                    // Tối ưu hơn: Chỉ thông báo cho những user có match với user này
                    var relatedUserIds = await _context.Matches
                        .Where(m => m.User1ID == userId || m.User2ID == userId)
                        .Select(m => m.User1ID == userId ? m.User2ID : m.User1ID)
                        .Distinct()
                        .ToListAsync();

                    foreach (var relatedUserId in relatedUserIds)
                    {
                        var connections = GetConnectionsForUser(relatedUserId.ToString());
                        if (connections.Any())
                        {
                            await Clients.Clients(connections).UserStatusChanged(userId, isOnline, isOnline ? (DateTimeOffset?)null : user.LastLoginDate);
                        }
                    }
                }
                catch (DbUpdateException ex)
                {
                    Console.WriteLine($"[ChatHub] Error updating user status for {userId}: {ex.Message}");
                }
            }
        }
        public static List<string> GetConnectionsForUser(string userId)
        {
            // Trả về một bản copy để tránh thay đổi list gốc khi duyệt
            return UserConnectionsMap.TryGetValue(userId, out var connections) ? connections.ToList() : new List<string>();
        }
        // In ChatHub.cs

        // Trong ChatHub.cs
        public async Task UserStartedTyping(int matchId, int typingUserId)
        {
            var match = await _context.Matches
                                    .Include(m => m.User1) // Include để lấy thông tin user
                                    .Include(m => m.User2)
                                    .FirstOrDefaultAsync(m => m.MatchID == matchId);
            if (match == null) return;

            var typingUser = (match.User1ID == typingUserId) ? match.User1 : match.User2;
            if (typingUser == null) return;

            var otherUserId = (match.User1ID == typingUserId) ? match.User2ID : match.User1ID;
            var connections = GetConnectionsForUser(otherUserId.ToString());
            if (connections.Any())
            {
                // Gửi thêm typingUser.FullName (hoặc Username)
                await Clients.Clients(connections).NotifyTyping(matchId, typingUserId, typingUser.FullName ?? typingUser.Username);
            }
        }

        public async Task UserStoppedTyping(int matchId, int typingUserId)
        {
            var match = await _context.Matches.FindAsync(matchId);
            if (match == null) return;

            var otherUserId = (match.User1ID == typingUserId) ? match.User2ID : match.User1ID;
            var connections = GetConnectionsForUser(otherUserId.ToString());
            if (connections.Any())
            {
                await Clients.Clients(connections).NotifyStoppedTyping(matchId, typingUserId);
            }
        }
    }
}