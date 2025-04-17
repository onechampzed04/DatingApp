using System.Text.RegularExpressions;

namespace DatingAppAPI.Models
{
    public class User
    {
        public int UserID { get; set; }
        public string Username { get; set; }
        public string PasswordHash { get; set; }
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTime? Birthdate { get; set; }
        public string? Bio { get; set; }
        public string? ProfileImageURL { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public DateTime CreatedAt { get; set; }

        public ICollection<Photo> Photos { get; set; }
        public ICollection<Swipe> SwipesMade { get; set; }
        public ICollection<Swipe> SwipesReceived { get; set; }
        public ICollection<Match> Matches1 { get; set; }
        public ICollection<Match> Matches2 { get; set; }
        public ICollection<Message> Messages { get; set; }
    }

}
