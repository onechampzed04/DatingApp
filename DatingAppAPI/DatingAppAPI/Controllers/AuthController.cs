using DatingAppAPI.DTO;
using DatingAppAPI.Models; // Required for User model if used in responses directly
using DatingAppAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations; // Required for [EmailAddress], [Required] for DTOs

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
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
                _logger.LogError(ex, "[Register] Registration failed for email {Email}", registerDto.Email);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            try
            {
                var result = await _authService.LoginAsync(loginDto);
                return Ok(new { message = "Login attempt processed.", data = result });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Login] Login failed for email {Email}", loginDto.Email);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("send-otp")] // This is for general OTP sending, e.g., after registration
        public async Task<IActionResult> SendOtp([FromBody] string email) // << REVERTED TO [FromBody] string email
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "Email is required." });
            }
            try
            {
                await _authService.SendOtpAsync(email);
                return Ok(new { message = "OTP sent to your email." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SendOtp] Failed to send OTP to {Email}", email);
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
                        _logger.LogWarning($"[VerifyOtp] User not found for email {otpDto.Email} after OTP verification success flag.");
                        return BadRequest(new { message = "User not found despite OTP verification success." });
                    }

                    try
                    {
                        var token = _authService.GenerateJwtToken(user);
                        _logger.LogInformation($"[VerifyOtp] OTP verified successfully for email {otpDto.Email}. Returning user and token.");
                        return Ok(new
                        {
                            message = "OTP verified successfully.",
                            data = new
                            {
                                user = new // Consider a UserSummaryDto here
                                {
                                    userId = user.UserID,
                                    username = user.Username,
                                    email = user.Email,
                                    isEmailVerified = user.IsEmailVerified
                                },
                                token
                            }
                        });
                    }
                    catch (InvalidOperationException ex)
                    {
                        _logger.LogError(ex, $"[VerifyOtp] Token generation failed for {otpDto.Email} after OTP verification.");
                        return StatusCode(500, new { message = "OTP verified but token generation failed. Please try again." });
                    }
                }
                _logger.LogWarning($"[VerifyOtp] Invalid or expired OTP for email {otpDto.Email}.");
                return BadRequest(new { message = "Invalid or expired OTP." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[VerifyOtp] Error verifying OTP for email {otpDto.Email}");
                return StatusCode(500, new { message = "An error occurred while verifying OTP." });
            }
        }

        [HttpPost("check-email")]
        public async Task<IActionResult> CheckEmail([FromBody] string email) // << REVERTED TO [FromBody] string email
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "Email is required." });
            }
            try
            {
                var user = await _authService.CheckEmailAsync(email);
                return Ok(new { message = "Email check successful.", data = new { exists = user != null } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CheckEmail] Error checking email {Email}", email);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDTO changePasswordDto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
            {
                _logger.LogWarning("[ChangePassword] Unauthorized: User ID claim not found or invalid.");
                return Unauthorized(new { message = "Unauthorized: User ID claim not found or invalid." });
            }

            try
            {
                var success = await _authService.ChangePasswordAsync(userId, changePasswordDto);
                if (success)
                {
                    _logger.LogInformation("[ChangePassword] Password changed successfully for user ID {UserId}.", userId);
                    return Ok(new { message = "Password changed successfully." });
                }
                _logger.LogError("[ChangePassword] ChangePasswordAsync returned false for user ID {UserId} without throwing an exception (should not happen).", userId);
                return BadRequest(new { message = "Failed to change password." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ChangePassword] Error changing password for user ID {UserId}.", userId);
                return BadRequest(new { message = ex.Message });
            }
        }

        // --- NEW ENDPOINTS FOR FORGOT PASSWORD FLOW ---

        [HttpPost("forgot-password/send-otp")]
        public async Task<IActionResult> SendForgotPasswordOtp([FromBody] string email) // << Using [FromBody] string email
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "Email is required." });
            }
            // Basic email format validation (optional, can be more robust)
            if (!new EmailAddressAttribute().IsValid(email))
            {
                return BadRequest(new { message = "Invalid email format." });
            }

            try
            {
                var user = await _authService.CheckEmailAsync(email);
                if (user == null)
                {
                    _logger.LogInformation("[SendForgotPasswordOtp] Attempt to send OTP to non-existent email (or user chose to hide existence): {Email}", email);
                    return Ok(new { message = "If your email address is registered, you will receive an OTP." });
                }

                await _authService.SendOtpAsync(email); // SendOtpAsync is designed to send OTP for an existing user
                _logger.LogInformation("[SendForgotPasswordOtp] OTP sent for password reset to email: {Email}", email);
                return Ok(new { message = "OTP sent to your email for password reset. Please check your inbox (and spam folder)." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SendForgotPasswordOtp] Error sending OTP for email {Email}", email);
                return Ok(new { message = "If your email address is registered and our system is operational, you will receive an OTP. If issues persist, please contact support." });
            }
        }

        [HttpPost("forgot-password/reset")]
        public async Task<IActionResult> ResetPasswordWithOtp([FromBody] ResetPasswordDto resetPasswordDto)
        {
            if (!ModelState.IsValid) // Validates ResetPasswordDto properties
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _authService.ResetPasswordAfterOtpAsync(resetPasswordDto);
                if (success)
                {
                    _logger.LogInformation("[ResetPasswordWithOtp] Password reset successfully for email {Email}", resetPasswordDto.Email);
                    return Ok(new { message = "Password has been reset successfully." });
                }
                else
                {
                    _logger.LogWarning("[ResetPasswordWithOtp] Failed to reset password for email {Email}. OTP might be invalid/expired or other issue.", resetPasswordDto.Email);
                    return BadRequest(new { message = "Invalid OTP, OTP expired, or unable to reset password. Please ensure the OTP is correct and not expired, then try again or request a new OTP." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ResetPasswordWithOtp] Error resetting password for email {Email}", resetPasswordDto.Email);
                return StatusCode(500, new { message = "An error occurred while resetting your password. Please try again later." });
            }
        }
    }
}