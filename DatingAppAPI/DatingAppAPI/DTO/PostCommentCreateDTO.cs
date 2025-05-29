using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class PostCommentCreateDTO
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; }
        public int? ParentCommentID { get; set; } // Để trả lời một comment khác
    }
}