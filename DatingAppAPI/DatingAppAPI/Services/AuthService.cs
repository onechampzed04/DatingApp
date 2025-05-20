using DatingAppAPI.Data;
using DatingAppAPI.Models;
using DatingAppAPI.DTO;
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

        public AuthService(DatingAppDbContext context, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
        }

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
                IsEmailVerified = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await SendOtpAsync(registerDto.Email);

            return new AuthResponseDto
            {
                Username = user.Username,
                Email = user.Email,
                Token = null
            };
        }

        public async Task<AuthResponseDto> LoginAsync(LoginDto loginDto)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);
            if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
            {
                throw new Exception("Invalid email or password.");
            }

            if (!user.IsEmailVerified)
            {
                await SendOtpAsync(user.Email);
                throw new Exception("Email not verified. OTP sent.");
            }

            var token = GenerateJwtToken(user);
            return new AuthResponseDto
            {
                Username = user.Username,
                Email = user.Email,
                Token = token
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

    }
}