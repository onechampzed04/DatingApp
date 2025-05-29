using DatingAppAPI.Models; // Để dùng ReactionType
using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class PostReactionCreateDTO
    {
        [Required]
        public ReactionType ReactionType { get; set; }
    }
}