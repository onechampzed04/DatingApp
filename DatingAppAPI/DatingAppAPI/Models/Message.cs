// File: Models/Message.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DatingAppAPI.Models
{ 
    public enum MessageType
    {
        Text = 0,
        Image = 1,
        Video = 2 // Tùy chọn
        // Thêm các loại khác nếu cần
    }
    public class Message
    {
        [Key]
        public int MessageID { get; set; }

        [Required]
        public int MatchID { get; set; }
        [ForeignKey("MatchID")]
        public virtual Match Match { get; set; }

        [Required]
        public int SenderID { get; set; } // Giữ nguyên tên này
        [ForeignKey("SenderID")]
        public virtual User Sender { get; set; }

        // --- THÊM MỚI ---
        [Required]
        public int ReceiverUserID { get; set; } // ID của người nhận trong Match
        // Không cần FK trực tiếp ở đây nếu không muốn, vì đã có MatchID
        // [ForeignKey("ReceiverUserID")]
        // public virtual User Receiver { get; set; } // Nếu thêm thì cần config OnDelete cho nó

        [Required]
        [MaxLength(1000)]
        public string MessageText { get; set; } // Giữ nguyên tên này

        public DateTimeOffset SentTime { get; set; } = DateTime.UtcNow; // Giữ nguyên tên này

        // --- THÊM MỚI ---
        public bool IsRead { get; set; } = false;
        public MessageType Type { get; set; } = MessageType.Text;
        public string? MediaUrl { get; set; }
    }
}