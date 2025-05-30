using DatingAppAPI.Data;
using DatingAppAPI.DTO;
using DatingAppAPI.Hubs;
using DatingAppAPI.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DatingAppAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly DatingAppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly IHubContext<ChatHub, IChatClient> _chatHubContext; // << THÊM TRƯỜNG NÀY
        private readonly ILogger<AuthService> _logger; // << THÊM TRƯỜNG ILogger

        public AuthService(
             DatingAppDbContext context,
             IConfiguration configuration,
             IEmailService emailService,
             ILogger<AuthService> logger, // Inject ILogger
             IHubContext<ChatHub, IChatClient>? chatHubContext = null) // chatHubContext có thể là optional
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _logger = logger; // Gán logger
            _chatHubContext = chatHubContext;
        }

        // DatingAppAPI.Services/AuthService.cs
        public async Task<AuthResponseDto> RegisterAsync(RegisterDto registerDto)
        {
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == registerDto.Email || u.Username == registerDto.Username);
            if (existingUser != null)
            {
                throw new Exception("Email or username already exists.");
            }

            var user = new User
            {
                Username = registerDto.Username,
                Email = registerDto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(registerDto.Password),
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = false // Mặc định khi đăng ký
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync(); // Lưu để user.UserID có giá trị

            await SendOtpAsync(registerDto.Email);

            return new AuthResponseDto
            {
                UserID = user.UserID, // Trả về UserID
                Username = user.Username,
                Email = user.Email,
                Token = null, // Mới đăng ký, chưa có token
                IsEmailVerified = false // Luôn là false khi mới đăng ký
            };
        }

        // DatingAppAPI.Services/AuthService.cs
        public async Task<AuthResponseDto> LoginAsync(LoginDto loginDto)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
            {
                // Sai email hoặc mật khẩu
                throw new Exception("Invalid email or password."); // Controller sẽ bắt và trả 400
            }

            // Nếu email/password đúng, kiểm tra trạng thái verify
            if (!user.IsEmailVerified)
            {
                // Email đúng, mật khẩu đúng, NHƯNG CHƯA VERIFY
                await SendOtpAsync(user.Email); // Vẫn gửi OTP nếu bạn muốn
                                                // KHÔNG NÉM EXCEPTION NỮA
                                                // Trả về thông tin user, không có token, và đánh dấu isVerified = false
                                                // Controller sẽ nhận DTO này và trả về 200 OK
                return new AuthResponseDto
                {
                    UserID = user.UserID,
                    Username = user.Username,
                    Email = user.Email,
                    Token = null, // Không cấp token cho đến khi verify OTP
                    IsEmailVerified = false
                };
            }
            user.AccountStatus = UserAccountStatus.Online; // << CẬP NHẬT TRẠNG THÁI ONLINE
            user.LastLoginDate = DateTimeOffset.UtcNow;    // << CẬP NHẬT LAST LOGIN
            await _context.SaveChangesAsync();             // << LƯU THAY ĐỔI

            // Email đúng, mật khẩu đúng, ĐÃ VERIFY
            var token = GenerateJwtToken(user);
            var relatedUserIds = await _context.Matches
            .Where(m => m.User1ID == user.UserID || m.User2ID == user.UserID)
            .Select(m => m.User1ID == user.UserID ? m.User2ID : m.User1ID)
            .Distinct()
            .ToListAsync();

            foreach (var relatedUserId in relatedUserIds)
            {
                var connections = ChatHub.GetConnectionsForUser(relatedUserId.ToString());
                if (connections.Any())
                {
                    // Sử dụng _chatHubContext vì đang ở ngoài Hub class
                    await _chatHubContext.Clients.Clients(connections).UserStatusChanged(user.UserID, true, null);
                }
            }
            Console.WriteLine($"[AuthService] User {user.UserID} logged in. Status set to Online. LastLogin: {user.LastLoginDate}");


            return new AuthResponseDto
            {
                UserID = user.UserID,
                Username = user.Username,
                Email = user.Email,
                Token = token,
                IsEmailVerified = true
            };
        }
        public async Task SendOtpToEmailAsync(string email)
        {
            // Có thể thêm kiểm tra định dạng email ở đây nếu muốn

            var otpCode = new Random().Next(100000, 999999).ToString();
            var otp = new EmailOTP
            {
                Email = email,
                OtpCode = otpCode,
                ExpirationTime = DateTime.UtcNow.AddMinutes(5),
                IsUsed = false
            };

            _context.EmailOtps.Add(otp);
            await _context.SaveChangesAsync();

            var emailBody = $"<h3>Your OTP Code</h3><p>Your OTP code is <b>{otpCode}</b>. It is valid for 5 minutes.</p>";
            await _emailService.SendEmailAsync(email, "Dating App OTP Verification", emailBody);
        }

        public async Task SendOtpAsync(string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                throw new Exception("User not found.");
            }

            var otpCode = new Random().Next(100000, 999999).ToString();
            var otp = new EmailOTP
            {
                Email = email,
                OtpCode = otpCode,
                ExpirationTime = DateTime.UtcNow.AddMinutes(5),
                IsUsed = false
            };

            _context.EmailOtps.Add(otp);
            await _context.SaveChangesAsync();

            var emailBody = $"<h3>Your OTP Code</h3><p>Your OTP code is <b>{otpCode}</b>. It is valid for 5 minutes.</p>";
            await _emailService.SendEmailAsync(email, "Dating App OTP Verification", emailBody);
        }

        public async Task<bool> VerifyOtpAsync(OtpDto otpDto)
        {
            try
            {
                var now = DateTime.UtcNow;
                var otp = await _context.EmailOtps
                    .FirstOrDefaultAsync(o => o.Email == otpDto.Email 
                                            && o.OtpCode == otpDto.OtpCode 
                                            && !o.IsUsed 
                                            && o.ExpirationTime > now);
                if (otp == null)
                {
                    Console.WriteLine($"OTP verification failed for email {otpDto.Email}. OTP: {otpDto.OtpCode}. Current time: {now}, Expiry check: {otp?.ExpirationTime}");
                    return false;
                }

                otp.IsUsed = true;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == otpDto.Email);
                if (user == null)
                {
                    Console.WriteLine($"User not found for email {otpDto.Email} during OTP verification.");
                    return false;
                }

                user.IsEmailVerified = true;
                await _context.SaveChangesAsync();
                Console.WriteLine($"OTP verified successfully for email {otpDto.Email}. UserID: {user.UserID}, IsEmailVerified: {user.IsEmailVerified}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error verifying OTP for email {otpDto.Email}: {ex.Message}");
                return false;
            }
        }

        public async Task<User> CheckEmailAsync(string email)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        }

        public string GenerateJwtToken(User user)
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var jwtKey = jwtSettings["Secret"];
            var jwtIssuer = jwtSettings["Issuer"];
            var jwtAudience = jwtSettings["Audience"];
            var expiryMinutes = int.Parse(jwtSettings["ExpiryMinutes"] ?? "60");

            Console.WriteLine($"JWT Config - Secret: {jwtKey}, Issuer: {jwtIssuer}, Audience: {jwtAudience}, ExpiryMinutes: {expiryMinutes}");

            if (string.IsNullOrEmpty(jwtKey))
            {
                throw new InvalidOperationException("JWT Secret is not configured in JwtSettings.");
            }

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserID.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Name, user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.Now.AddMinutes(expiryMinutes),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<string> GenerateTokenAsync(User user)
        {
            var claims = new[]
            {
            new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddDays(30),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }   
        public async Task<User> GetUserByEmailAsync(string email)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        }
        // TRIỂN KHAI PHƯƠ_NG THỨC ĐỔI MẬT KHẨU
        public async Task<bool> ChangePasswordAsync(int userId, ChangePasswordDTO changePasswordDto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserID == userId);
            if (user == null)
            {
                _logger.LogWarning("[ChangePasswordAsync] User with ID {UserId} not found.", userId);
                throw new Exception("User not found."); // Hoặc một exception cụ thể hơn
            }

            // Kiểm tra mật khẩu cũ
            if (!BCrypt.Net.BCrypt.Verify(changePasswordDto.OldPassword, user.PasswordHash))
            {
                _logger.LogWarning("[ChangePasswordAsync] Invalid old password for user ID {UserId}.", userId);
                throw new Exception("Invalid old password.");
            }

            // Hash mật khẩu mới và cập nhật
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(changePasswordDto.NewPassword);
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            _logger.LogInformation("[ChangePasswordAsync] Password changed successfully for user ID {UserId}.", userId);
            return true;
        }
        public async Task<bool> ResetPasswordAfterOtpAsync(ResetPasswordDto resetPasswordDto)
        {
            _logger.LogInformation("[ResetPasswordAfterOtpAsync] Attempting to reset password for email {Email}", resetPasswordDto.Email);

            var now = DateTimeOffset.UtcNow; // Consistent DateTimeOffset
            var otpEntry = await _context.EmailOtps
                .FirstOrDefaultAsync(o => o.Email == resetPasswordDto.Email
                                        && o.OtpCode == resetPasswordDto.OtpCode
                                        && !o.IsUsed
                                        && o.ExpirationTime > now);

            if (otpEntry == null)
            {
                _logger.LogWarning("[ResetPasswordAfterOtpAsync] Invalid, expired, or used OTP for email {Email}. OTP: {OtpCode}", resetPasswordDto.Email, resetPasswordDto.OtpCode);
                return false;
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == resetPasswordDto.Email);
            if (user == null)
            {
                _logger.LogWarning("[ResetPasswordAfterOtpAsync] User not found for email {Email} after OTP validation. This should not happen if OTP was for a valid user.", resetPasswordDto.Email);
                // Mark OTP as used to prevent reuse, even if user is somehow not found.
                otpEntry.IsUsed = true;
                await _context.SaveChangesAsync();
                return false;
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(resetPasswordDto.NewPassword);
            _context.Users.Update(user);

            otpEntry.IsUsed = true;
            // No need to _context.EmailOtps.Update(otpEntry) if it's tracked by EF Core

            await _context.SaveChangesAsync();
            _logger.LogInformation("[ResetPasswordAfterOtpAsync] Password reset successfully for email {Email}, User ID {UserId}.", resetPasswordDto.Email, user.UserID);
            return true;
        }
    }
}