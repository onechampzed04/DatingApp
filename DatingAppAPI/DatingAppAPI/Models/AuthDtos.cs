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

    public class AuthResponseDto
    {
        public string Token { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
    }
}