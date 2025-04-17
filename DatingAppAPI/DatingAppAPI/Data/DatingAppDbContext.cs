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
        }
    }
}
