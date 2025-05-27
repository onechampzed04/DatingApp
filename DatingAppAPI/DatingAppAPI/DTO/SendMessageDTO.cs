// File: DTO/SendMessageDTO.cs
using System.ComponentModel.DataAnnotations;
// If MessageTypeEnum is defined in MessageDTO.cs, ensure you have a using for it,
// or define it in a way that SendMessageDTO can access it (e.g., in a shared DTO namespace).
// For simplicity, let's assume MessageTypeEnum from MessageDTO is accessible.
// using static DatingAppAPI.DTO.MessageDTO; // If MessageTypeEnum is nested in MessageDTO

namespace DatingAppAPI.DTO
{
    public class SendMessageDTO
    {
        [Required]
        public int MatchID { get; set; }

        [MaxLength(1000)]
        public string Content { get; set; } // Can be caption for media

        public MessageTypeEnum Type { get; set; } = MessageTypeEnum.Text;

        public string? MediaUrl { get; set; } // URL of the uploaded image/video
    }
}