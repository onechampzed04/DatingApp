using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class PostCreateDTO
    {
        [Required]
        [MaxLength(2000)]
        public string Content { get; set; }

        // Client sẽ gửi file ảnh/video, server sẽ xử lý và lưu URL
        // Hoặc client tự upload lên cloud storage và gửi URL về đây
        public string? ImageUrl { get; set; } // Optional: nếu client tự quản lý upload
        public string? VideoUrl { get; set; } // Optional

        // Nếu server xử lý upload:
        // public IFormFile ImageFile { get; set; }
        // public IFormFile VideoFile { get; set; }
    }
}