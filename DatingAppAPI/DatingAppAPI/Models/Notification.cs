// File: Models/Nofication.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DatingAppAPI.Models
{
    public enum NotificationType
    {
        NewMatch = 1,
        PostReaction = 2,
        PostComment = 3,
        CommentReply = 4,
        NewMessage = 5 // Thêm cái này nếu bạn cũng muốn thông báo tin nhắn mới ở đây
        // Thêm các loại khác nếu cần trong tương lai
    }
    public class Notification
    {
        [Key]
        public int NotificationID { get; set; }

        [Required]
        public int RecipientUserID { get; set; } // Người nhận thông báo
        [ForeignKey("RecipientUserID")]
        public virtual User RecipientUser { get; set; }

        [Required]
        public NotificationType Type { get; set; }

        [Required]
        [MaxLength(255)]
        public string MessageText { get; set; } // Nội dung thông báo, ví dụ: "Linh đã thích bài viết của bạn."

        public int? SenderUserID { get; set; } // Người gây ra thông báo (người like, comment, match...)
        [ForeignKey("SenderUserID")]
        public virtual User SenderUser { get; set; }

        public int? ReferenceID { get; set; } // ID của thực thể liên quan (PostID, MatchID, CommentID)
                                              // Có thể là string nếu ID là GUID hoặc phức tạp hơn

        public bool IsRead { get; set; } = false;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}