namespace DatingAppAPI.Models
{
    public class Interest
    {
        public int InterestId { get; set; }
        public string InterestName { get; set; }

        public ICollection<UserInterest> UserInterests { get; set; }
    }

}
