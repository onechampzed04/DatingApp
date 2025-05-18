using DatingAppAPI.Models;
using DatingAppAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
        {
            try
            {
                var result = await _authService.RegisterAsync(registerDto);
                return Ok(new { message = "Registration successful. Please verify your email with OTP.", data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            try
            {
                var result = await _authService.LoginAsync(loginDto);
                return Ok(new { message = "Login successful.", data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("send-otp")]
        public async Task<IActionResult> SendOtp([FromBody] string email)
        {
            try
            {
                await _authService.SendOtpAsync(email);
                return Ok(new { message = "OTP sent to your email." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtp([FromBody] OtpDto otpDto)
        {
            var result = await _authService.VerifyOtpAsync(otpDto);
            if (result)
            {
                return Ok(new { message = "OTP verified successfully." });
            }
            return BadRequest(new { message = "Invalid or expired OTP." });
        }

        [HttpPost("check-email")]
        public async Task<IActionResult> CheckEmail([FromBody] string email)
        {
            try
            {
                var user = await _authService.CheckEmailAsync(email);
                return Ok(new { message = "Email check successful.", data = new { exists = user != null } });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("send-otp-for-any")]
        public async Task<IActionResult> SendOtpForAny([FromBody] string email)
        {
            try
            {
                await _authService.SendOtpToEmailAsync(email);
                return Ok(new { message = "OTP sent to the provided email address." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

    }
}
