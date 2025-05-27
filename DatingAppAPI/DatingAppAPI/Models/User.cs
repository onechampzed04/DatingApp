using System;
using System.Collections.Generic;

namespace DatingAppAPI.Models
{
    public enum UserAccountStatus
    {
        Offline = 0,
        Online = 1
    }
    public class User
    {
        public int UserID { get; set; }
        public string Username { get; set; }
        public string PasswordHash { get; set; }
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTimeOffset ? Birthdate { get; set; }
        public string? Bio { get; set; }
        public string? Avatar { get; set; }           // Đổi tên ProfileImageURL thành Avatar
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public DateTimeOffset  CreatedAt { get; set; }

        public string? PhoneNumber { get; set; }        // Thêm trường PhoneNumber
        public string? Email { get; set; }              // Thêm trường Email
        public string? FacebookID { get; set; }         // Thêm trường FacebookID
        public string? GoogleID { get; set; }           // Thêm trường GoogleID
        public DateTimeOffset ? LastLoginDate { get; set; }    // Thêm trường LastLoginDate
        public bool IsEmailVerified { get; set; }       // Thêm trường IsEmailVerified
        public int? ProfileVisibility { get; set; }     // Thêm trường ProfileVisibility
        public UserAccountStatus? AccountStatus { get; set; } // Thay int? bằng UserAccountStatus?
        public string? Address { get; set; }            // Thêm trường Address

        public ICollection<Photo> Photos { get; set; }
        public ICollection<Swipe> SwipesMade { get; set; }
        public ICollection<Swipe> SwipesReceived { get; set; }
        public ICollection<Match> Matches1 { get; set; }
        public ICollection<Match> Matches2 { get; set; }
        public ICollection<Message> Messages { get; set; }
        public ICollection<UserInterest> UserInterests { get; set; }
    }
}
