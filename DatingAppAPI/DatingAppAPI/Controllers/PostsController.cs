// File: Controllers/PostsController.cs
using DatingAppAPI.Data;
using DatingAppAPI.DTO;
using DatingAppAPI.Models; // For ReactionType, UserAccountStatus, etc.
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
// using Microsoft.AspNetCore.SignalR; // Nếu bạn dùng SignalR để thông báo
// using DatingAppAPI.Hubs; // Namespace của Hub

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PostsController : ControllerBase
    {
        private readonly DatingAppDbContext _context;
        // private readonly IHubContext<NotificationHub, INotificationClient> _notificationHubContext; // Ví dụ nếu có NotificationHub

        public PostsController(DatingAppDbContext context /*, IHubContext<NotificationHub, INotificationClient> notificationHubContext*/)
        {
            _context = context;
            // _notificationHubContext = notificationHubContext;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                // This will be caught by the global exception handler or return 500 if not handled before.
                // For specific actions, it's better to return UnauthorizedObjectResult or similar.
                throw new UnauthorizedAccessException("User ID not found or invalid in token.");
            }
            return userId;
        }

        private ActionResult HandleUnauthorizedAccess()
        {
            return Unauthorized(new ProblemDetails { Title = "Unauthorized Access", Detail = "User ID claim not found, invalid, or user does not exist." });
        }


        // POST: api/posts
        [HttpPost]
        public async Task<ActionResult<PostDTO>> CreatePost([FromBody] PostCreateDTO postCreateDto)
        {
            int currentUserId;
            try
            {
                currentUserId = GetCurrentUserId();
            }
            catch (UnauthorizedAccessException)
            {
                return HandleUnauthorizedAccess();
            }

            var user = await _context.Users.FindAsync(currentUserId);
            if (user == null)
            {
                return HandleUnauthorizedAccess(); // User from token ID does not exist in DB
            }

            if (string.IsNullOrWhiteSpace(postCreateDto.Content) &&
                string.IsNullOrWhiteSpace(postCreateDto.ImageUrl) &&
                string.IsNullOrWhiteSpace(postCreateDto.VideoUrl))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid Post", Detail = "Post must have content, an image, or a video." });
            }

            var post = new Post
            {
                UserID = currentUserId,
                Content = postCreateDto.Content?.Trim(), // Trim content
                ImageUrl = !string.IsNullOrWhiteSpace(postCreateDto.ImageUrl) ? postCreateDto.ImageUrl : null,
                VideoUrl = !string.IsNullOrWhiteSpace(postCreateDto.VideoUrl) ? postCreateDto.VideoUrl : null,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            // TODO: Gửi thông báo đến bạn bè (sẽ thảo luận sau)
            // await NotifyFriendsAboutNewPost(currentUserId, post.PostID);

            var postDto = MapPostToDTO(post, user, new List<PostReaction>(), new List<PostComment>(), currentUserId);
            return CreatedAtAction(nameof(GetPost), new { postId = post.PostID }, postDto);
        }

        // GET: api/posts/{postId}
        [HttpGet("{postId}")]
        [AllowAnonymous]
        public async Task<ActionResult<PostDTO>> GetPost(int postId)
        {
            var post = await _context.Posts
                .Include(p => p.User)
                .Include(p => p.Reactions)
                .Include(p => p.Comments)
                    .ThenInclude(c => c.User)
                .Include(p => p.Comments)
                    .ThenInclude(c => c.Replies)
                        .ThenInclude(r => r.User)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.PostID == postId);

            if (post == null)
            {
                return NotFound(new ProblemDetails { Title = "Post Not Found", Detail = $"Post with ID {postId} was not found." });
            }

            int? currentUserId = null;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
            {
                currentUserId = parsedUserId;
            }

            // Lấy comments gốc và map chúng
            var rootComments = post.Comments
                .Where(c => c.ParentCommentID == null)
                .OrderByDescending(c => c.CreatedAt) // Sắp xếp comment gốc mới nhất lên đầu
                .ToList(); // Materialize before mapping

            var postDto = MapPostToDTO(post, post.User, post.Reactions.ToList(), rootComments, currentUserId);
            return Ok(postDto);
        }

        // GET: api/posts (Feed - ví dụ: public posts hoặc posts của người mình follow/bạn bè)
        [HttpGet]
        [AllowAnonymous] // Hoặc [Authorize] tùy chính sách
        public async Task<ActionResult<IEnumerable<PostDTO>>> GetPosts([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] int? forUserId = null)
        {
            if (pageNumber <= 0) pageNumber = 1;
            if (pageSize <= 0) pageSize = 10;
            if (pageSize > 50) pageSize = 50; // Giới hạn max page size

            IQueryable<Post> postsQuery = _context.Posts.AsNoTracking();

            if (forUserId.HasValue) // Lấy posts của một user cụ thể
            {
                postsQuery = postsQuery.Where(p => p.UserID == forUserId.Value);
            }
            else
            {
                // Logic cho feed chung:
                // Ví dụ: Lấy public posts, hoặc posts của bạn bè, người mình follow...
                // Hiện tại, lấy tất cả posts (đơn giản hóa)
                // Bạn cần điều chỉnh logic này cho phù hợp
                // postsQuery = postsQuery.Where(p => p.IsPublic); // Nếu có cờ IsPublic
            }

            var totalItems = await postsQuery.CountAsync();

            var posts = await postsQuery
                .Include(p => p.User)
                .Include(p => p.Reactions)
                // Không include comments sâu ở đây để tối ưu, chỉ đếm số lượng
                .OrderByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            int? currentUserId = null;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
            {
                currentUserId = parsedUserId;
            }

            var postDtos = new List<PostDTO>();
            foreach (var post in posts)
            {
                // Đếm tổng số comment cho mỗi post một cách hiệu quả
                var totalCommentsForPost = await _context.PostComments.CountAsync(c => c.PostID == post.PostID);
                var dto = MapPostToDTO(post, post.User, post.Reactions.ToList(), new List<PostComment>(), currentUserId, totalCommentsForPost, true); // isListView = true
                postDtos.Add(dto);
            }

            // Trả về kết quả kèm thông tin phân trang nếu cần (ví dụ trong header hoặc body)
            // Response.Headers.Add("X-Pagination", Newtonsoft.Json.JsonConvert.SerializeObject(new { totalItems, pageSize, pageNumber, totalPages = (int)Math.Ceiling(totalItems / (double)pageSize) }));
            return Ok(postDtos);
        }


        // PUT: api/posts/{postId}
        [HttpPut("{postId}")]
        public async Task<IActionResult> UpdatePost(int postId, [FromBody] PostUpdateDTO postUpdateDto)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.PostID == postId && p.UserID == currentUserId);

            if (post == null)
            {
                return NotFound(new ProblemDetails { Title = "Post Not Found or Not Authorized", Detail = "You can only edit your own posts." });
            }

            bool updated = false;
            if (!string.IsNullOrWhiteSpace(postUpdateDto.Content) && post.Content != postUpdateDto.Content)
            {
                post.Content = postUpdateDto.Content.Trim();
                updated = true;
            }
            // Cho phép xóa ImageUrl/VideoUrl nếu DTO gửi về null hoặc chuỗi rỗng
            // (Cân nhắc logic này, có thể client sẽ không gửi field nếu không muốn thay đổi)
            // Nếu bạn muốn client phải gửi rõ ràng là null để xóa:
            // if (postUpdateDto.GetType().GetProperty(nameof(PostUpdateDTO.ImageUrl)) != null && postUpdateDto.ImageUrl != post.ImageUrl)
            // {
            //    post.ImageUrl = string.IsNullOrWhiteSpace(postUpdateDto.ImageUrl) ? null : postUpdateDto.ImageUrl;
            //    updated = true;
            // }
            // if (postUpdateDto.GetType().GetProperty(nameof(PostUpdateDTO.VideoUrl)) != null && postUpdateDto.VideoUrl != post.VideoUrl)
            // {
            //    post.VideoUrl = string.IsNullOrWhiteSpace(postUpdateDto.VideoUrl) ? null : postUpdateDto.VideoUrl;
            //    updated = true;
            // }


            if (updated)
            {
                post.UpdatedAt = DateTimeOffset.UtcNow;
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!await _context.Posts.AnyAsync(p => p.PostID == postId)) return NotFound();
                    else throw;
                }
            }
            return NoContent();
        }

        // DELETE: api/posts/{postId}
        [HttpDelete("{postId}")]
        public async Task<IActionResult> DeletePost(int postId)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.PostID == postId && p.UserID == currentUserId);

            if (post == null)
            {
                return NotFound(new ProblemDetails { Title = "Post Not Found or Not Authorized", Detail = "You can only delete your own posts." });
            }

            // TODO: Xóa file media liên quan khỏi storage nếu cần (quan trọng)
            // if (!string.IsNullOrEmpty(post.ImageUrl)) DeleteFileFromStorage(post.ImageUrl);
            // if (!string.IsNullOrEmpty(post.VideoUrl)) DeleteFileFromStorage(post.VideoUrl);

            _context.Posts.Remove(post); // Reactions và Comments sẽ bị xóa theo cascade nếu đã cấu hình
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // --- REACTIONS ---
        [HttpPost("{postId}/reactions")]
        public async Task<IActionResult> AddOrUpdateReaction(int postId, [FromBody] PostReactionCreateDTO reactionDto)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var postExists = await _context.Posts.AnyAsync(p => p.PostID == postId);
            if (!postExists) return NotFound(new ProblemDetails { Title = "Post Not Found" });

            var existingReaction = await _context.PostReactions
                .FirstOrDefaultAsync(r => r.PostID == postId && r.UserID == currentUserId);

            if (existingReaction != null)
            {
                if (existingReaction.ReactionType == reactionDto.ReactionType)
                {
                    _context.PostReactions.Remove(existingReaction); // Toggle off
                }
                else
                {
                    existingReaction.ReactionType = reactionDto.ReactionType; // Change reaction
                    _context.PostReactions.Update(existingReaction);
                }
            }
            else
            {
                var newReaction = new PostReaction
                {
                    PostID = postId,
                    UserID = currentUserId,
                    ReactionType = reactionDto.ReactionType,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.PostReactions.Add(newReaction);
            }

            await _context.SaveChangesAsync();

            // Trả về thông tin reaction counts mới của post
            var reactionSummary = await GetPostReactionSummary(postId, currentUserId);
            return Ok(reactionSummary);
        }

        [HttpGet("{postId}/reactions")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<PostReactionDTO>>> GetPostReactions(int postId, [FromQuery] ReactionType? type = null)
        {
            var postExists = await _context.Posts.AnyAsync(p => p.PostID == postId);
            if (!postExists) return NotFound(new ProblemDetails { Title = "Post Not Found" });

            var query = _context.PostReactions
                .Where(r => r.PostID == postId)
                .Include(r => r.User)
                .AsNoTracking();

            if (type.HasValue)
            {
                query = query.Where(r => r.ReactionType == type.Value);
            }

            var reactions = await query
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new PostReactionDTO
                {
                    PostReactionID = r.PostReactionID,
                    UserID = r.UserID,
                    Username = r.User.FullName ?? r.User.Username,
                    ReactionType = r.ReactionType,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(reactions);
        }

        // --- COMMENTS ---
        [HttpPost("{postId}/comments")]
        public async Task<ActionResult<PostCommentDTO>> AddComment(int postId, [FromBody] PostCommentCreateDTO commentDto)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var post = await _context.Posts.FindAsync(postId);
            if (post == null) return NotFound(new ProblemDetails { Title = "Post Not Found" });

            if (string.IsNullOrWhiteSpace(commentDto.Content))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid Comment", Detail = "Comment content cannot be empty." });
            }

            if (commentDto.ParentCommentID.HasValue)
            {
                var parentComment = await _context.PostComments.FindAsync(commentDto.ParentCommentID.Value);
                if (parentComment == null || parentComment.PostID != postId)
                {
                    return BadRequest(new ProblemDetails { Title = "Invalid Parent Comment", Detail = "Parent comment not found or does not belong to this post." });
                }
            }

            var user = await _context.Users.FindAsync(currentUserId); // For DTO
            if (user == null) return HandleUnauthorizedAccess();


            var newComment = new PostComment
            {
                PostID = postId,
                UserID = currentUserId,
                Content = commentDto.Content.Trim(),
                ParentCommentID = commentDto.ParentCommentID,
                CreatedAt = DateTimeOffset.UtcNow,
                User = user // Gán trực tiếp để MapCommentToDTO có thể sử dụng ngay
            };

            _context.PostComments.Add(newComment);
            await _context.SaveChangesAsync();

            // TODO: Gửi thông báo cho chủ post (và parent comment author nếu là reply)
            // if (post.UserID != currentUserId) await NotifyUser(post.UserID, $"New comment on your post");
            // if (commentDto.ParentCommentID.HasValue) {
            //    var parent = await _context.PostComments.FindAsync(commentDto.ParentCommentID.Value);
            //    if(parent.UserID != currentUserId && parent.UserID != post.UserID) await NotifyUser(parent.UserID, $"New reply to your comment");
            // }

            var resultDto = MapCommentToDTO(newComment, new List<PostComment>(), currentUserId, user);
            return CreatedAtAction(nameof(GetComment), new { postId = postId, commentId = newComment.PostCommentID }, resultDto);
        }

        [HttpGet("{postId}/comments/{commentId}")]
        [AllowAnonymous]
        public async Task<ActionResult<PostCommentDTO>> GetComment(int postId, int commentId)
        {
            var comment = await _context.PostComments
                .Include(c => c.User)
                .Include(c => c.Replies)
                    .ThenInclude(r => r.User)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.PostCommentID == commentId && c.PostID == postId);

            if (comment == null)
            {
                return NotFound(new ProblemDetails { Title = "Comment not found" });
            }
            int? currentUserId = null;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
            {
                currentUserId = parsedUserId;
            }

            var replies = comment.Replies.OrderByDescending(r => r.CreatedAt).ToList();
            return Ok(MapCommentToDTO(comment, replies, currentUserId, comment.User));
        }

        [HttpGet("{postId}/comments")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<PostCommentDTO>>> GetPostComments(int postId, [FromQuery] int? parentCommentId = null, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10)
        {
            if (pageNumber <= 0) pageNumber = 1;
            if (pageSize <= 0) pageSize = 10;
            if (pageSize > 50) pageSize = 50;

            var postExists = await _context.Posts.AnyAsync(p => p.PostID == postId);
            if (!postExists) return NotFound(new ProblemDetails { Title = "Post not found" });

            IQueryable<PostComment> commentsQuery = _context.PostComments
                .Where(c => c.PostID == postId)
                .Include(c => c.User)
                .Include(c => c.Replies) // Chỉ include để đếm, không load sâu replies ở list view này
                                         // .ThenInclude(r => r.User) // Không cần user của replies ở đây
                .AsNoTracking();

            if (parentCommentId.HasValue) // Lấy replies cho một comment cụ thể
            {
                commentsQuery = commentsQuery.Where(c => c.ParentCommentID == parentCommentId.Value);
            }
            else // Lấy comment gốc
            {
                commentsQuery = commentsQuery.Where(c => c.ParentCommentID == null);
            }

            var totalItems = await commentsQuery.CountAsync();

            var comments = await commentsQuery
                .OrderByDescending(c => c.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            int? currentUserId = null;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
            {
                currentUserId = parsedUserId;
            }

            var commentDtos = comments.Select(c => MapCommentToDTO(c, new List<PostComment>(), currentUserId, c.User, true)).ToList(); // isListView = true

            // Response.Headers.Add("X-Pagination", Newtonsoft.Json.JsonConvert.SerializeObject(new { totalItems, pageSize, pageNumber, totalPages = (int)Math.Ceiling(totalItems / (double)pageSize) }));
            return Ok(commentDtos);
        }


        [HttpPut("{postId}/comments/{commentId}")]
        public async Task<IActionResult> UpdateComment(int postId, int commentId, [FromBody] PostCommentUpdateDTO commentDto)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            if (string.IsNullOrWhiteSpace(commentDto.Content))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid Comment", Detail = "Comment content cannot be empty." });
            }

            var comment = await _context.PostComments
                .FirstOrDefaultAsync(c => c.PostCommentID == commentId && c.PostID == postId && c.UserID == currentUserId);

            if (comment == null)
            {
                return NotFound(new ProblemDetails { Title = "Comment Not Found or Not Authorized", Detail = "You can only edit your own comments." });
            }

            comment.Content = commentDto.Content.Trim();
            comment.UpdatedAt = DateTimeOffset.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{postId}/comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(int postId, int commentId)
        {
            int currentUserId;
            try { currentUserId = GetCurrentUserId(); }
            catch (UnauthorizedAccessException) { return HandleUnauthorizedAccess(); }

            var comment = await _context.PostComments
                .Include(c => c.Replies) // Để xóa cascade các replies liên quan
                .FirstOrDefaultAsync(c => c.PostCommentID == commentId && c.PostID == postId && c.UserID == currentUserId);

            if (comment == null)
            {
                // Admin có thể xóa comment của người khác, cần thêm logic role-based access control
                // var isAdmin = User.IsInRole("Admin");
                // if (!isAdmin) return NotFound(...)
                // if (isAdmin) comment = await _context.PostComments.Include(c => c.Replies).FirstOrDefaultAsync(c => c.PostCommentID == commentId && c.PostID == postId);
                // if (comment == null) return NotFound(...);
                return NotFound(new ProblemDetails { Title = "Comment Not Found or Not Authorized", Detail = "You can only delete your own comments." });
            }

            // Xóa tất cả replies của comment này (DB sẽ tự làm nếu có cascade delete cho ParentCommentID)
            if (comment.Replies.Any())
            {
                _context.PostComments.RemoveRange(comment.Replies);
            }
            _context.PostComments.Remove(comment);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // --- Helper Methods ---
        private PostDTO MapPostToDTO(Post post, User postUser, List<PostReaction> reactions, List<PostComment> rootCommentsData, int? currentUserId, int? preCalculatedTotalComments = null, bool isListView = false)
        {
            var reactionCounts = reactions.GroupBy(r => r.ReactionType)
                                        .ToDictionary(g => g.Key, g => g.Count());
            var currentUserReactionType = currentUserId.HasValue ? reactions.FirstOrDefault(r => r.UserID == currentUserId.Value)?.ReactionType : null;

            List<PostCommentDTO> commentDTOs;
            if (isListView) // Cho list view, không load replies chi tiết
            {
                commentDTOs = new List<PostCommentDTO>(); // Hoặc có thể load 1-2 top comments
            }
            else // Cho detail view
            {
                commentDTOs = rootCommentsData
                                .Select(c => MapCommentToDTO(c, c.Replies?.OrderByDescending(rep => rep.CreatedAt).ToList() ?? new List<PostComment>(), currentUserId, c.User, false))
                                .ToList();
            }

            int totalComments;
            if (preCalculatedTotalComments.HasValue)
            {
                totalComments = preCalculatedTotalComments.Value;
            }
            else
            {
                // Nếu không có preCalculatedTotalComments, và không phải list view, thì đếm từ rootCommentsData và replies của chúng
                totalComments = rootCommentsData.Count + rootCommentsData.SelectMany(c => c.Replies ?? new List<PostComment>()).Count();
            }


            return new PostDTO
            {
                PostID = post.PostID,
                User = new PostUserDTO { UserID = postUser.UserID, Username = postUser.Username, FullName = postUser.FullName, Avatar = postUser.Avatar },
                Content = post.Content,
                ImageUrl = post.ImageUrl,
                VideoUrl = post.VideoUrl,
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt,
                TotalReactions = reactions.Count,
                ReactionCounts = reactionCounts,
                CurrentUserReaction = currentUserReactionType,
                TotalComments = totalComments,
                Comments = commentDTOs
            };
        }

        private PostCommentDTO MapCommentToDTO(PostComment comment, List<PostComment> repliesData, int? currentUserId, User commentUser, bool isListView = false)
        {
            List<PostCommentDTO> replyDTOs;
            if (isListView) // Cho list view, không load replies chi tiết
            {
                replyDTOs = new List<PostCommentDTO>();
            }
            else
            {
                // Lấy 2-3 replies gần nhất, hoặc client fetch riêng
                replyDTOs = repliesData.Take(3)
                                    .Select(r => MapCommentToDTO(r, r.Replies?.OrderByDescending(rep => rep.CreatedAt).ToList() ?? new List<PostComment>(), currentUserId, r.User, false)) // isListView = false cho replies
                                    .ToList();
            }

            return new PostCommentDTO
            {
                PostCommentID = comment.PostCommentID,
                PostID = comment.PostID,
                User = new PostUserDTO { UserID = commentUser.UserID, Username = commentUser.Username, FullName = commentUser.FullName, Avatar = commentUser.Avatar },
                ParentCommentID = comment.ParentCommentID,
                Content = comment.Content,
                CreatedAt = comment.CreatedAt,
                UpdatedAt = comment.UpdatedAt,
                RepliesCount = comment.Replies?.Count ?? 0, // Đếm từ DB nếu chưa load, hoặc từ collection đã load
                Replies = replyDTOs
                // TODO: Thêm thông tin reaction cho comment nếu cần
            };
        }

        private async Task<object> GetPostReactionSummary(int postId, int currentUserId)
        {
            var reactions = await _context.PostReactions
                                .Where(r => r.PostID == postId)
                                .ToListAsync();

            var reactionCounts = reactions
                                .GroupBy(r => r.ReactionType)
                                .ToDictionary(g => g.Key, g => g.Count());

            var currentUserReaction = reactions.FirstOrDefault(r => r.UserID == currentUserId)?.ReactionType;

            return new
            {
                totalReactions = reactions.Count,
                reactionCounts,
                currentUserReaction
            };
        }


        // private async Task NotifyFriendsAboutNewPost(int posterId, int postId)
        // {
        //    // Logic tìm bạn bè của posterId
        //    // Ví dụ: Giả sử bạn có bảng Friendships hoặc logic tương tự
        //    var friendUserIds = await _context.Friendships
        //        .Where(f => (f.UserId1 == posterId && f.Status == FriendshipStatus.Accepted) || 
        //                      (f.UserId2 == posterId && f.Status == FriendshipStatus.Accepted))
        //        .Select(f => f.UserId1 == posterId ? f.UserId2 : f.UserId1)
        //        .ToListAsync();
        //
        //    if (friendUserIds.Any())
        //    {
        //        var poster = await _context.Users.FindAsync(posterId);
        //        var message = $"{poster?.FullName ?? poster?.Username} just created a new post.";
        //        var notification = new CreateNotificationDTO // DTO để tạo notification
        //        {
        //            Message = message,
        //            NotificationType = NotificationType.NewPost, // Enum
        //            TargetEntityId = postId,
        //            // ... các trường khác
        //        };
        //
        //        foreach (var friendId in friendUserIds)
        //        {
        //            // 1. Lưu notification vào DB
        //            // await _notificationService.CreateNotificationForUser(friendId, notification);
        //
        //            // 2. Gửi real-time notification qua SignalR nếu user đó online
        //            // var connections = NotificationHub.GetConnectionsForUser(friendId.ToString());
        //            // if (connections.Any())
        //            // {
        //            //    await _notificationHubContext.Clients.Clients(connections).ReceiveNotification(new NotificationDTO { /* ... */ });
        //            // }
        //        }
        //    }
        // }
    }
}