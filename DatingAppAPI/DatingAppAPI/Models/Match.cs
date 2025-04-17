namespace DatingAppAPI.Models
{
    public class Match
    {
        public int MatchID { get; set; }
        public int User1ID { get; set; }
        public int User2ID { get; set; }
        public DateTime MatchTime { get; set; }

        public User User1 { get; set; }
        public User User2 { get; set; }

        public ICollection<Message> Messages { get; set; }
    }

}
