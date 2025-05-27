// File: DTO/MessageDTO.cs
namespace DatingAppAPI.DTO
{
    // Add this if not already present in a shared location
    public enum MessageTypeEnum // Renamed to avoid conflict if MessageType in Models is also an enum
    {
        Text = 0,
        Image = 1,
        Video = 2
    }

    public class MessageDTO
    {
        public int MessageID { get; set; }
        public int MatchID { get; set; }
        public int SenderUserID { get; set; }
        public string? SenderFullName { get; set; } // Changed from SenderUsername for consistency
        public string? SenderAvatar { get; set; }
        public int ReceiverUserID { get; set; }
        public string Content { get; set; }
        public DateTimeOffset  Timestamp { get; set; }
        public bool IsRead { get; set; }
        public bool IsMe { get; set; } // True nếu SenderUserID là user hiện tại
        public MessageTypeEnum Type { get; set; } // Use the DTO-specific enum
        public string? MediaUrl { get; set; }
    }
}