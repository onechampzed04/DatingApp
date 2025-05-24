namespace DatingAppAPI.DTO
{
    public class MatchedUserDetailsDTO
    {
        public int UserId { get; set; }
        public string? FullName { get; set; }
        public string? Avatar { get; set; }
        public int? Age { get; set; }
    }

    public class SwipeMatchResponseDTO
    {
        public string Message { get; set; }
        public bool IsMatch { get; set; }
        public MatchedUserDetailsDTO? MatchedWithUser { get; set; }
    }
}
