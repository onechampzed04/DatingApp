// DatingAppAPI.Models/AuthResponseDto.cs
namespace DatingAppAPI.Models
{
    public class RegisterDto
    {
        public string Username { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class LoginDto
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class OtpDto
    {
        public string Email { get; set; }
        public string OtpCode { get; set; }
    }

    public class AuthResponseDto // ĐÂY LÀ DTO CHO RESPONSE CỦA LOGIN VÀ REGISTER
    {
        public string Username { get; set; }
        public string Email { get; set; }
        public string? Token { get; set; } // Cho phép null nếu chưa verify hoặc register
        public bool IsEmailVerified { get; set; } // THÊM TRƯỜNG NÀY
        public int UserID { get; set; } // THÊM TRƯỜNG NÀY
    }
}