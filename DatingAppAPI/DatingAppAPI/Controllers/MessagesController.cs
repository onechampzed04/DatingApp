// File: Controllers/MessagesController.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DatingAppAPI.Data;
using DatingAppAPI.Models;
using DatingAppAPI.DTO; // Ensure this is present
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using DatingAppAPI.Hubs; // Ensure this is present

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly DatingAppDbContext _context;
        private readonly IHubContext<ChatHub, IChatClient> _hubContext;
        // private readonly IWebHostEnvironment _hostingEnvironment; // Needed if uploading directly here

        public MessagesController(DatingAppDbContext context, IHubContext<ChatHub, IChatClient> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
            // _hostingEnvironment = hostingEnvironment;
        }

        // POST: api/Messages/send
        [HttpPost("send")]
        public async Task<ActionResult<MessageDTO>> SendMessage([FromBody] SendMessageDTO sendMessageDto)
        {
            var senderUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (senderUserIdClaim == null || !int.TryParse(senderUserIdClaim, out int senderUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID không hợp lệ từ token." });
            }

            var match = await _context.Matches
                .Include(m => m.User1) // For sender/receiver details
                .Include(m => m.User2)
                .FirstOrDefaultAsync(m => m.MatchID == sendMessageDto.MatchID && (m.User1ID == senderUserId || m.User2ID == senderUserId));

            if (match == null)
            {
                return NotFound(new ProblemDetails { Title = "Match Not Found", Detail = "Không tìm thấy match hoặc bạn không thuộc match này." });
            }

            int receiverUserId = (match.User1ID == senderUserId) ? match.User2ID : match.User1ID;
            var senderUser = (match.User1ID == senderUserId) ? match.User1 : match.User2; // Get User object for sender

            var message = new Message
            {
                MatchID = sendMessageDto.MatchID,
                SenderID = senderUserId,
                ReceiverUserID = receiverUserId,
                MessageText = sendMessageDto.Content,
                SentTime = DateTime.UtcNow,
                IsRead = false,
                Type = (DatingAppAPI.Models.MessageType)sendMessageDto.Type, // Cast DTO enum to Model enum
                MediaUrl = sendMessageDto.MediaUrl
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var messageDto = new MessageDTO
            {
                MessageID = message.MessageID,
                MatchID = message.MatchID,
                SenderUserID = message.SenderID,
                SenderFullName = senderUser.FullName, // Or Username if FullName is null
                SenderAvatar = senderUser.Avatar,
                ReceiverUserID = message.ReceiverUserID,
                Content = message.MessageText,
                Timestamp = message.SentTime,
                IsRead = message.IsRead,
                IsMe = true, // For the sender, this message is "Me"
                Type = (DatingAppAPI.DTO.MessageTypeEnum)message.Type, // Cast Model enum to DTO enum
                MediaUrl = message.MediaUrl
            };

            // Broadcast to receiver
            var receiverConnections = ChatHub.GetConnectionsForUser(receiverUserId.ToString());
            if (receiverConnections.Any())
            {
                var messageDtoForReceiver = new MessageDTO // Create a new DTO for receiver where IsMe = false
                {
                    MessageID = message.MessageID,
                    MatchID = message.MatchID,
                    SenderUserID = message.SenderID,
                    SenderFullName = senderUser.FullName,
                    SenderAvatar = senderUser.Avatar,
                    ReceiverUserID = message.ReceiverUserID,
                    Content = message.MessageText,
                    Timestamp = message.SentTime,
                    IsRead = message.IsRead, // Will be false initially
                    IsMe = false,
                    Type = (DatingAppAPI.DTO.MessageTypeEnum)message.Type,
                    MediaUrl = message.MediaUrl
                };
                await _hubContext.Clients.Clients(receiverConnections).ReceiveMessage(messageDtoForReceiver);
            }


            // Also send back to sender's other connections (e.g., if logged in on multiple devices)
            var senderConnections = ChatHub.GetConnectionsForUser(senderUserId.ToString());
            if (senderConnections.Any())
            {
                await _hubContext.Clients.Clients(senderConnections).ReceiveMessage(messageDto); // Send the original DTO where IsMe = true
            }


            return Ok(messageDto); // Return to the calling client
        }

        // GET: api/Messages/match/{matchId}
        [HttpGet("match/{matchId}")]
        public async Task<ActionResult<IEnumerable<MessageDTO>>> GetMessagesForMatch(int matchId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int currentUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID không hợp lệ." });
            }

            // Validate user is part of the match
            var isUserInMatch = await _context.Matches.AnyAsync(m => m.MatchID == matchId && (m.User1ID == currentUserId || m.User2ID == currentUserId));
            if (!isUserInMatch)
            {
                return Forbid("You are not part of this match.");
            }

            var messages = await _context.Messages
                .Include(m => m.Sender) // To get Sender's FullName and Avatar
                .Where(m => m.MatchID == matchId)
                .OrderByDescending(m => m.SentTime)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .OrderBy(m => m.SentTime) // Re-order for chronological display after pagination
                .Select(m => new MessageDTO
                {
                    MessageID = m.MessageID,
                    MatchID = m.MatchID,
                    SenderUserID = m.SenderID,
                    SenderFullName = m.Sender.FullName, // Or m.Sender.Username
                    SenderAvatar = m.Sender.Avatar,
                    ReceiverUserID = m.ReceiverUserID,
                    Content = m.MessageText,
                    Timestamp = m.SentTime,
                    IsRead = m.IsRead,
                    IsMe = (m.SenderID == currentUserId),
                    Type = (DatingAppAPI.DTO.MessageTypeEnum)m.Type,
                    MediaUrl = m.MediaUrl
                })
                .ToListAsync();

            return Ok(messages);
        }

        // GET: api/Messages/conversations
        [HttpGet("conversations")]
        public async Task<ActionResult<IEnumerable<ConversationPreviewDTO>>> GetConversationPreviews()
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int currentUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID không hợp lệ." });
            }

            var matches = await _context.Matches
                .Include(m => m.User1)
                .Include(m => m.User2)
                .Include(m => m.Messages) // Eager load messages to find the last one efficiently
                .Where(m => m.User1ID == currentUserId || m.User2ID == currentUserId)
                .ToListAsync();

            var conversationPreviews = new List<ConversationPreviewDTO>();

            foreach (var match in matches)
            {
                var matchedUser = (match.User1ID == currentUserId) ? match.User2 : match.User1;
                var lastMessage = match.Messages.OrderByDescending(m => m.SentTime).FirstOrDefault();
                var unreadCount = match.Messages.Count(m => m.ReceiverUserID == currentUserId && !m.IsRead);

                conversationPreviews.Add(new ConversationPreviewDTO
                {
                    MatchID = match.MatchID,
                    MatchedUserID = matchedUser.UserID,
                    MatchedUsername = matchedUser.FullName, // Or Username
                    MatchedUserAvatar = matchedUser.Avatar,
                    LastMessageContent = lastMessage?.MessageText,
                    LastMessageTimestamp = lastMessage?.SentTime,
                    UnreadCount = unreadCount,
                    IsLastMessageFromMe = lastMessage?.SenderID == currentUserId,
                    // --- THÊM MỚI ---
                    IsMatchedUserOnline = matchedUser.AccountStatus == UserAccountStatus.Online, // Hoặc matchedUser.AccountStatus == 1
                    MatchedUserLastSeen = matchedUser.AccountStatus == UserAccountStatus.Online ? (DateTimeOffset?)null : matchedUser.LastLoginDate
                });
            }

            return Ok(conversationPreviews.OrderByDescending(c => c.IsMatchedUserOnline).ThenByDescending(c => c.LastMessageTimestamp));
        }


        // POST: api/Messages/match/{matchId}/read
        [HttpPost("match/{matchId}/read")]
        public async Task<IActionResult> MarkMessagesAsRead(int matchId)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserIdClaim == null || !int.TryParse(currentUserIdClaim, out int currentUserId))
            {
                return Unauthorized(new ProblemDetails { Title = "Unauthorized", Detail = "User ID không hợp lệ." });
            }

            var messagesToUpdate = await _context.Messages
                .Where(m => m.MatchID == matchId && m.ReceiverUserID == currentUserId && !m.IsRead)
                .ToListAsync();

            if (messagesToUpdate.Any())
            {
                foreach (var message in messagesToUpdate)
                {
                    message.IsRead = true;
                }
                await _context.SaveChangesAsync();

                var messagesJustRead = messagesToUpdate.Where(m => m.SenderID != currentUserId).ToList(); // Chỉ quan tâm tin nhắn của người khác
                if (messagesJustRead.Any())
                {
                    // Group by SenderID để gửi 1 thông báo cho mỗi người gửi nếu cần
                    var messagesBySender = messagesJustRead.GroupBy(m => m.SenderID);
                    foreach (var group in messagesBySender)
                    {
                        var senderIdToNotify = group.Key;
                        var messageIdsRead = group.Select(m => m.MessageID).ToList();
                        var senderConnections = ChatHub.GetConnectionsForUser(senderIdToNotify.ToString());
                        if (senderConnections.Any())
                        {
                            await _hubContext.Clients.Clients(senderConnections).MessagesReadNotification(matchId, currentUserId, messageIdsRead);
                        }
                    }
                }
            }
            return Ok(new { message = $"{messagesToUpdate.Count} messages marked as read." });
        }


        // --- Standard CRUD (you might not need all of these if focusing on chat flow) ---
        [HttpGet] // Get all messages (admin?)
        public async Task<ActionResult<IEnumerable<Message>>> GetAllMessages()
        {
            return await _context.Messages.ToListAsync();
        }

        [HttpGet("{id}")] // Get specific message by ID (admin/debug?)
        public async Task<ActionResult<Message>> GetMessage(int id)
        {
            var message = await _context.Messages.FindAsync(id);
            if (message == null) return NotFound();
            return message;
        }
        // PUT and DELETE are less common for individual messages in a chat app context by users,
        // but can be kept for admin purposes or specific features.
    }
}