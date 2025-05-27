namespace DatingAppAPI.Models
{
    public class Swipe
    {
        public int SwipeID { get; set; }
        public int FromUserID { get; set; }
        public int ToUserID { get; set; }
        public bool IsLike { get; set; }
        public DateTimeOffset  SwipeTime { get; set; }

        public User FromUser { get; set; }
        public User ToUser { get; set; }
    }

}
