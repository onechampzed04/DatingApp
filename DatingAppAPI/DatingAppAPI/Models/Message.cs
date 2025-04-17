namespace DatingAppAPI.Models
{
    public class Message
    {
        public int MessageID { get; set; }
        public int MatchID { get; set; }
        public int SenderID { get; set; }
        public string MessageText { get; set; }
        public DateTime SentTime { get; set; }

        public Match Match { get; set; }
        public User Sender { get; set; }
    }

}
