using DatingAppAPI.Models;

namespace DatingAppAPI.Services
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto registerDto);
        Task<AuthResponseDto> LoginAsync(LoginDto loginDto);
        Task<User> GetUserByEmailAsync(string email);
        Task<string> GenerateTokenAsync(User user);
        Task SendOtpAsync(string email);
        Task<bool> VerifyOtpAsync(OtpDto otpDto);
        Task<User> CheckEmailAsync(string email);
        Task SendOtpToEmailAsync(string email);
        string GenerateJwtToken(User user);
    }
}