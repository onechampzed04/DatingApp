using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class PostUpdateDTO
    {
        [MaxLength(2000)]
        public string Content { get; set; }
        // Các trường khác có thể cập nhật nếu cần
    }
}