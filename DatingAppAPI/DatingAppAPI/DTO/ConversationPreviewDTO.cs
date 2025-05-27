// File: DTO/ConversationPreviewDTO.cs
namespace DatingAppAPI.DTO
{
    public class ConversationPreviewDTO
    {
        public int MatchID { get; set; }
        public int MatchedUserID { get; set; }
        public string? MatchedUsername { get; set; } // Sử dụng FullName nếu có, nếu không thì Username
        public string? MatchedUserAvatar { get; set; }
        public string? LastMessageContent { get; set; }
        public DateTimeOffset ? LastMessageTimestamp { get; set; }
        public int UnreadCount { get; set; }
        public bool IsLastMessageFromMe { get; set; }
        public bool IsMatchedUserOnline { get; set; }
        public DateTimeOffset? MatchedUserLastSeen { get; set; }    
    }
}