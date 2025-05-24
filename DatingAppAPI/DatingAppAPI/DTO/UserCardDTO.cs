namespace DatingAppAPI.DTO
{
    public class UserCardDTO
    {
        public int UserID { get; set; }       // Hoặc userId nếu bạn muốn camelCase ở đây
        public string? FullName { get; set; }
        public string? Avatar { get; set; }
        public int? Age { get; set; }
    }
}