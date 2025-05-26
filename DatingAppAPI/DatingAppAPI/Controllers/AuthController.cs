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

        // DatingAppAPI.Controllers/AuthController.cs
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            try
            {
                var result = await _authService.LoginAsync(loginDto); // result giờ sẽ là AuthResponseDto
                                                                      // Client sẽ kiểm tra result.IsEmailVerified
                return Ok(new { message = "Login attempt processed.", data = result });
            }
            catch (Exception ex) // Exception này giờ chỉ là "Invalid email or password."
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
            try
            {
                var result = await _authService.VerifyOtpAsync(otpDto);
                if (result)
                {
                    var user = await _authService.GetUserByEmailAsync(otpDto.Email);
                    if (user == null)
                    {
                        Console.WriteLine($"User not found for email {otpDto.Email} after OTP verification.");
                        return BadRequest(new { message = "User not found." });
                    }

                    try
                    {
                        var token = _authService.GenerateJwtToken(user);
                        Console.WriteLine($"OTP verified successfully for email {otpDto.Email}. Returning user and token.");
                        return Ok(new
                        {
                            message = "OTP verified successfully.",
                            data = new
                            {
                                user = new
                                {
                                    userId = user.UserID,
                                    username = user.Username,
                                    email = user.Email,
                                    isEmailVerified = user.IsEmailVerified // Thêm trường này
                                },
                                token
                            }
                        });
                    }
                    catch (InvalidOperationException ex)
                    {
                        Console.WriteLine($"Failed to generate token for email {otpDto.Email}: {ex.Message}");
                        return StatusCode(500, new { message = "OTP verified but token generation failed. Please try again." });
                    }
                }
                Console.WriteLine($"Invalid or expired OTP for email {otpDto.Email}.");
                return BadRequest(new { message = "Invalid or expired OTP." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error verifying OTP for email {otpDto.Email}: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while verifying OTP." });
            }
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
