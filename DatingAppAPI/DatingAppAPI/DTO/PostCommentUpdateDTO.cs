using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class PostCommentUpdateDTO
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; }
    }
}