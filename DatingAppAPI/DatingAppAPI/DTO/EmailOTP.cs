namespace DatingAppAPI.DTO
{
    public class EmailOTP
    {
        public int Id { get; set; }
        public string Email { get; set; }
        public string OtpCode { get; set; }
        public DateTime ExpirationTime { get; set; }
        public bool IsUsed { get; set; } = false;
    }

}
