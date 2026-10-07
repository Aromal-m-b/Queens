from collections import deque
from typing import Dict, Any, List, Tuple
def initialize_seed(n:int,placement : list[int]) -> Dict[str, Any]:

    grid = [[-1 for _ in range(n)] for _ in range(n)]
    visited = [[False for _ in range(n)] for _ in range(n)]
    queue = deque()

    for r in range(n):
        c = placement[r]
        grid[r][c] = r
        visited[r][c] =True
        queue.append((r,c))

    cells_to_assign: List[Tuple[int, int]] = []
    directions = [(-1,0),(1,0),(0,-1),(0,1)]
    while queue:
        curr_row, curr_col = queue.popleft()

        for dr, dc in directions:
            nr, nc = curr_row + dr, curr_col + dc
            if 0 <= nr <n and 0 <= nc < n and not visited[nr][nc]:
                visited[nr][nc] = True
                cells_to_assign.append((nr, nc))
                queue.append((nr,nc))
    tried_region_stack = [[] for _ in range(len(cells_to_assign))]

    return {
        "grid": grid,
        "cells_to_assign": cells_to_assign,
        "tried_region_stack": tried_region_stack,
    }
