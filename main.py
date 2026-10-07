from typing import TypedDict,Optional
from components import generator,seed_init
class Board(TypedDict):
    id : str
    size : int
    grid : str
    solutions : list[list[int]]

board : Board = {'id': '1', 'size': int(input('Enter the no of Queens : ')), 'grid': '', 'solutions': ''}
board["solutions"] = generator.QueenPlacement(board['size'])
print(board["solutions"])
print(seed_init.initialize_seed(board['size'],board["solutions"][0]))
