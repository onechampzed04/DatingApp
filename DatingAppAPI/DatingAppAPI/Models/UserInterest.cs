namespace DatingAppAPI.Models
{
    public class UserInterest
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public int InterestId { get; set; }
        public Interest Interest { get; set; }
    }

}
