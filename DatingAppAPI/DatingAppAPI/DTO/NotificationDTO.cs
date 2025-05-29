// File: DTO/NotificationDTO.cs
using System;

namespace DatingAppAPI.DTO
{
    public enum NotificationTypeEnum
    {
        NewMatch = 1,
        PostReaction = 2,
        PostComment = 3,
        CommentReply = 4,
        NewMessage = 5
    }
    public class NotificationDTO
    {
        public string NotificationID { get; set; } // Sử dụng string cho ID để linh hoạt
        public int RecipientUserID { get; set; }
        public NotificationTypeEnum NotificationType { get; set; }
        public string MessageText { get; set; }
        public string? ReferenceID { get; set; } // PostId, MatchId, CommentId
        public int? SenderUserID { get; set; }
        public string? SenderUsername { get; set; }
        public string? SenderAvatar { get; set; }
        public bool IsRead { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}