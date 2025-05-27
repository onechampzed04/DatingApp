// File: Controllers/MediaController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http; // Required for IFormFile and StatusCodes

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Users must be logged in to upload media
    public class MediaController : ControllerBase
    {
        private readonly IWebHostEnvironment _hostingEnvironment;

        public MediaController(IWebHostEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }

        [HttpPost("upload/chat-media")]
        public async Task<IActionResult> UploadChatMedia(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new ProblemDetails { Title = "Upload Error", Detail = "No file uploaded or file is empty." });

            // Optional: Add file size validation
            if (file.Length > 10 * 1024 * 1024) // Example: 10MB limit
            {
                return BadRequest(new ProblemDetails { Title = "File Too Large", Detail = "File size exceeds the 10MB limit." });
            }

            // Optional: Add file type validation (check extension or MIME type)
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mov", ".avi", ".wmv" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid File Type", Detail = "Invalid file type. Allowed types: " + string.Join(", ", allowedExtensions) });
            }

            var uploadsFolderPath = Path.Combine(_hostingEnvironment.WebRootPath, "uploads", "chat_media");
            if (!Directory.Exists(uploadsFolderPath))
            {
                Directory.CreateDirectory(uploadsFolderPath);
            }

            var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(file.FileName);
            var filePath = Path.Combine(uploadsFolderPath, uniqueFileName);

            try
            {
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Return the relative URL to be stored in the message
                var relativeUrl = $"/uploads/chat_media/{uniqueFileName}";
                return Ok(new { url = relativeUrl });
            }
            catch (Exception ex)
            {
                // Log the exception (ex)
                Console.WriteLine($"Error uploading chat media: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError, new ProblemDetails { Title = "Upload Failed", Detail = "An error occurred while uploading the file." });
            }
        }
    }
}