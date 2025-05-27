// Program.cs
using DatingAppAPI.Data;
using DatingAppAPI.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;
using DatingAppAPI.Models; // << THÊM USING CHO MODEL USER
using System.Text.Json;  // << THÊM USING CHO JSONSERIALIZER

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSignalR();
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
});
builder.Services.AddDbContext<DatingAppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policyBuilder =>
    {
        policyBuilder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]))
        };
    });
builder.Services.AddControllers()
    .AddJsonOptions(options => // Quan trọng để tránh lỗi cyclic dependency khi serialize
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "DatingApp API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header... Example: \"Bearer 12345abcdef\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
                Scheme = "oauth2", Name = "Bearer", In = ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});

var app = builder.Build();

// --- SEEDING DATA ---
if (app.Environment.IsDevelopment()) // Chỉ seed trong môi trường Development
{
    // Lấy logger factory để truyền vào hàm seed nếu cần log phức tạp hơn
    // var loggerFactory = app.Services.GetRequiredService<ILoggerFactory>();
    // await SeedData.Initialize(app.Services, loggerFactory.CreateLogger<SeedData>());
    await SeedData.Initialize(app.Services); // Cách gọi đơn giản hơn
}
// --- END SEEDING DATA ---

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "DatingApp API V1"));
}
app.UseStaticFiles();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<DatingAppAPI.Hubs.ChatHub>("/chathub");
app.MapControllers();
app.Run();


// TẠO CLASS RIÊNG CHO LOGIC SEEDING (ví dụ: DataSeed/SeedData.cs)
// Hoặc bạn có thể đặt trực tiếp các hàm này ở cuối file Program.cs
public static class SeedData
{
    // Class DTO tạm để đọc từ JSON
    private class SeedUserDto
    {
        public string Username { get; set; }
        public string PasswordPlain { get; set; }
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTime? Birthdate { get; set; }
        public string? Bio { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public int? ProfileVisibility { get; set; }
        public string? Avatar { get; set; }
        public bool IsEmailVerified { get; set; }
        public int? AccountStatus { get; set; }
        public List<int>? InterestIds { get; set; } // Danh sách ID sở thích
    }

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using (var scope = serviceProvider.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<DatingAppDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>(); // Hoặc ILogger<SeedData>

            try
            {
                logger.LogInformation("Attempting to apply migrations...");
                await context.Database.MigrateAsync(); // Áp dụng migrations
                logger.LogInformation("Migrations applied successfully.");

                // 1. Seed Interests (nếu chưa có)
                // Danh sách interestId bạn cung cấp là từ 22 đến 42
                // Chúng ta sẽ giả định chúng đã có trong DB, nếu không bạn cần seed chúng trước.
                // Hoặc đảm bảo chúng tồn tại.
                var existingInterests = await context.Interests.ToDictionaryAsync(i => i.InterestId);
                var requiredInterestIds = Enumerable.Range(22, 21).ToList(); // 22 đến 42
                foreach (var id in requiredInterestIds)
                {
                    if (!existingInterests.ContainsKey(id))
                    {
                        // Nếu bạn muốn tự động tạo interest nếu thiếu, thêm code ở đây.
                        // Hiện tại, chúng ta giả định chúng phải tồn tại.
                        logger.LogWarning($"Interest with ID {id} not found in database. User interest seeding might fail for this ID.");
                    }
                }


                // 2. Seed Users
                if (await context.Users.AnyAsync())
                {
                    logger.LogInformation("Database already has users. Skipping user seeding.");
                    return;
                }

                logger.LogInformation("Seeding new users...");

                var usersJsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "seed_users.json");
                if (!File.Exists(usersJsonPath))
                {
                    logger.LogError($"Seed users file not found at {usersJsonPath}");
                    return;
                }
                var usersJson = await File.ReadAllTextAsync(usersJsonPath);
                var seedUserDtos = JsonSerializer.Deserialize<List<SeedUserDto>>(usersJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (seedUserDtos == null || !seedUserDtos.Any())
                {
                    logger.LogWarning("No users found in seed_users.json or failed to deserialize.");
                    return;
                }

                var usersToSeed = new List<User>();
                foreach (var dto in seedUserDtos)
                {
                    if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.PasswordPlain))
                    {
                        logger.LogWarning($"Skipping user due to missing Username or PasswordPlain: {dto.Username}");
                        continue;
                    }
                    if (usersToSeed.Any(u => u.Username == dto.Username)) // Kiểm tra trùng trong list đang seed
                    {
                        logger.LogWarning($"Username '{dto.Username}' is duplicated in seed data. Skipping.");
                        continue;
                    }
                    if (!string.IsNullOrEmpty(dto.Email) && usersToSeed.Any(u => u.Email == dto.Email))
                    {
                        logger.LogWarning($"Email '{dto.Email}' is duplicated in seed data for user {dto.Username}. Skipping.");
                        continue;
                    }

                    var user = new User
                    {
                        Username = dto.Username,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.PasswordPlain),
                        FullName = dto.FullName,
                        Gender = dto.Gender,
                        Birthdate = dto.Birthdate,
                        Bio = dto.Bio,
                        PhoneNumber = dto.PhoneNumber,
                        Email = dto.Email,
                        Address = dto.Address,
                        ProfileVisibility = dto.ProfileVisibility ?? 1,
                        Avatar = dto.Avatar,
                        CreatedAt = DateTime.UtcNow,
                        IsEmailVerified = dto.IsEmailVerified,
                        AccountStatus = dto.AccountStatus.HasValue
                                        ? (UserAccountStatus)dto.AccountStatus.Value // Ép kiểu từ int? (JSON) sang UserAccountStatus
                                        : UserAccountStatus.Online, // Mặc định là Online nếu không có trong JSON
                        Photos = new List<Photo>(),
                        SwipesMade = new List<Swipe>(),
                        SwipesReceived = new List<Swipe>(),
                        Matches1 = new List<Match>(),
                        Matches2 = new List<Match>(),
                        Messages = new List<Message>(),
                        UserInterests = new List<UserInterest>() // Khởi tạo
                    };

                    // Thêm UserInterests
                    if (dto.InterestIds != null && dto.InterestIds.Any())
                    {
                        foreach (var interestId in dto.InterestIds)
                        {
                            if (existingInterests.ContainsKey(interestId)) // Chỉ thêm nếu interest ID hợp lệ
                            {
                                user.UserInterests.Add(new UserInterest { InterestId = interestId });
                                // UserId sẽ được EF Core tự động gán khi User được lưu
                            }
                            else
                            {
                                logger.LogWarning($"User '{dto.Username}': InterestId {interestId} not found in DB. Skipping this interest.");
                            }
                        }
                    }
                    usersToSeed.Add(user);
                }

                if (usersToSeed.Any())
                {
                    await context.Users.AddRangeAsync(usersToSeed);
                    await context.SaveChangesAsync(); // Lưu users và userInterests
                    logger.LogInformation($"Seeded {usersToSeed.Count} new users and their interests.");
                }
                else
                {
                    logger.LogInformation("No new users to seed.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while seeding the database.");
                // Bạn có thể muốn ném lại lỗi ở đây nếu seeding là bắt buộc cho ứng dụng hoạt động
                // throw;
            }
        }
    }
}