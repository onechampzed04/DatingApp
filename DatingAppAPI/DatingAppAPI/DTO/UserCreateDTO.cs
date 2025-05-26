using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class UserCreateDTO
    {
        [Required]
        public string Username { get; set; }

        [Required]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters long.")]
        public string Password { get; set; } // Raw password from client

        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public DateTime? Birthdate { get; set; }
        public string? Bio { get; set; }
        public string? PhoneNumber { get; set; }

        [EmailAddress]
        public string? Email { get; set; }

        public int? ProfileVisibility { get; set; } // e.g., 1 for Public, 2 for Private
        public string? Address { get; set; }

        // Avatar will be handled by an IFormFile parameter in the controller action
    }
}