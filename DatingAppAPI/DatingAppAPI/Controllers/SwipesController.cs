using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DatingAppAPI.Data;
using DatingAppAPI.Models;

namespace DatingAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SwipesController : ControllerBase
    {
        private readonly DatingAppDbContext _context;

        public SwipesController(DatingAppDbContext context)
        {
            _context = context;
        }

        // GET: api/Swipes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Swipe>>> GetSwipes()
        {
            return await _context.Swipes.ToListAsync();
        }

        // GET: api/Swipes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Swipe>> GetSwipe(int id)
        {
            var swipe = await _context.Swipes.FindAsync(id);

            if (swipe == null)
            {
                return NotFound();
            }

            return swipe;
        }

        // PUT: api/Swipes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSwipe(int id, Swipe swipe)
        {
            if (id != swipe.SwipeID)
            {
                return BadRequest();
            }

            _context.Entry(swipe).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SwipeExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Swipes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<Swipe>> PostSwipe(Swipe swipe)
        {
            _context.Swipes.Add(swipe);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSwipe", new { id = swipe.SwipeID }, swipe);
        }

        // DELETE: api/Swipes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSwipe(int id)
        {
            var swipe = await _context.Swipes.FindAsync(id);
            if (swipe == null)
            {
                return NotFound();
            }

            _context.Swipes.Remove(swipe);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SwipeExists(int id)
        {
            return _context.Swipes.Any(e => e.SwipeID == id);
        }
    }
}
