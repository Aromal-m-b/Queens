def QueenPlacement(n : int) -> list[list[int]]:
    """
    Generates all valid queen placement for a board of n * n dimension
    :param n:int :
    :return list[list[int]]:
    """
    placements : list[list[int]] = []
    occupied : list[bool] = [False] * n
    current : list[int] = []

    def backtrack(r:int) -> None:
        if r== n:
            placements.append(list(current))
            return
        for c in range(n):
            if occupied[c]:
                continue
            if r>0 and abs(current[r-1] - c) <= 1:
                continue

            occupied[c] = True
            current.append(c)
            backtrack(r+1)
            current.pop()
            occupied[c] = False
    backtrack(0)
    return placements