using DatingAppAPI.DTO;
using DatingAppAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DatingAppAPI.Data
{
    public class DatingAppDbContext : DbContext
    {
        public DatingAppDbContext(DbContextOptions<DatingAppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Photo> Photos { get; set; }
        public DbSet<Swipe> Swipes { get; set; }
        public DbSet<Match> Matches { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<EmailOTP> EmailOtps { get; set; }
        public DbSet<Interest> Interests { get; set; }
        public DbSet<UserInterest> UserInterests { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Match>()
                .HasIndex(m => new { m.User1ID, m.User2ID })
                .IsUnique();

            // Swipe
            modelBuilder.Entity<Swipe>()
                .HasOne(s => s.FromUser)
                .WithMany(u => u.SwipesMade)
                .HasForeignKey(s => s.FromUserID)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Swipe>()
                .HasOne(s => s.ToUser)
                .WithMany(u => u.SwipesReceived)
                .HasForeignKey(s => s.ToUserID)
                .OnDelete(DeleteBehavior.NoAction);

            // Match
            modelBuilder.Entity<Match>()
                .HasOne(m => m.User1)
                .WithMany(u => u.Matches1)
                .HasForeignKey(m => m.User1ID)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Match>()
                .HasOne(m => m.User2)
                .WithMany(u => u.Matches2)
                .HasForeignKey(m => m.User2ID)
                .OnDelete(DeleteBehavior.NoAction);

            //interest
            modelBuilder.Entity<UserInterest>()
                .HasKey(ui => new { ui.UserId, ui.InterestId });

            modelBuilder.Entity<UserInterest>()
                .HasOne(ui => ui.User)
                .WithMany(u => u.UserInterests)
                .HasForeignKey(ui => ui.UserId);

            modelBuilder.Entity<UserInterest>()
                .HasOne(ui => ui.Interest)
                .WithMany(i => i.UserInterests)
                .HasForeignKey(ui => ui.InterestId);

            // message
            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasKey(e => e.MessageID);

                entity.HasOne(d => d.Match)
                    .WithMany(p => p.Messages) // Đảm bảo Match model có ICollection<Message> Messages
                    .HasForeignKey(d => d.MatchID)
                    .OnDelete(DeleteBehavior.Cascade); // Nếu Match bị xóa, tin nhắn liên quan cũng xóa (OK)

                entity.HasOne(d => d.Sender)
                    .WithMany(p => p.Messages) // Đảm bảo User model có ICollection<Message> Messages (Sent)
                    .HasForeignKey(d => d.SenderID)
                    .OnDelete(DeleteBehavior.Restrict); // HOẶC .NoAction // THAY ĐỔI: Tránh xóa User thì xóa Message của người khác

                // Không cần cấu hình cho ReceiverUserID nếu không tạo FK trực tiếp đến User table
            });
        }
    }
}
