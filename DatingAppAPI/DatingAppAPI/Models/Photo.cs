namespace DatingAppAPI.Models
{
    public class Photo
    {
        public int PhotoID { get; set; }
        public int UserID { get; set; }
        public string PhotoURL { get; set; }

        public User User { get; set; }
    }

}
