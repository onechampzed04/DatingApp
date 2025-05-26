namespace DatingAppAPI.DTO
{
    public class UserUpdateDTO
    {
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTime? Birthdate { get; set; }
        public string? Bio { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public int? ProfileVisibility { get; set; }
        public decimal? Latitude { get; set; }   // <-- THÊM DÒNG NÀY
        public decimal? Longitude { get; set; }  // <-- THÊM DÒNG NÀY
        // Avatar will be handled by an IFormFile parameter in the controller action
        // Email and Password changes should ideally have their own dedicated, secure endpoints/processes.
    }
}