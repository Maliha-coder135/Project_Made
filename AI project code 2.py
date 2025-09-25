import tkinter as tk
import random
import numpy as np

class Node:
    def __init__(self, data, state="Red", traffic_density=0):
        self.data = data
        self.state = state
        self.traffic_density = traffic_density  # Represents traffic density (0-100)
        self.left = None
        self.right = None

def create_node(data, state="Red", traffic_density=0):
    return Node(data, state, traffic_density)

def insert_node(root, data, state="Red", traffic_density=0):
    if root is None:
        return create_node(data, state, traffic_density)
    if data < root.data:
        root.left = insert_node(root.left, data, state, traffic_density)
    elif data > root.data:
        root.right = insert_node(root.right, data, state, traffic_density)
    return root

def inorder_traversal(root):
    if root is not None:
        inorder_traversal(root.left)
        print(f"Position: {root.data}, State: {root.state}, Traffic Density: {root.traffic_density}")
        inorder_traversal(root.right)

class QLearningAgent:
    def __init__(self, learning_rate=0.1, discount_factor=0.9, exploration_rate=1.0, exploration_decay=0.99):
        self.q_table = {}  # Q-table as a dictionary: {(state, action): value}
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_rate = exploration_rate
        self.exploration_decay = exploration_decay
        self.actions = ["Red", "Green", "Yellow"]  # Actions

    def get_q_value(self, state, action):
        return self.q_table.get((state, action), 0.0)

    def choose_action(self, state):
        if random.uniform(0, 1) < self.exploration_rate:
            return random.choice(self.actions)  # Exploration
        else:
            q_values = [self.get_q_value(state, a) for a in self.actions]
            max_q = max(q_values)
            return self.actions[q_values.index(max_q)]  # Exploitation

    def learn(self, state, action, reward, next_state):
        max_next_q = max([self.get_q_value(next_state, a) for a in self.actions])
        current_q = self.get_q_value(state, action)
        new_q = current_q + self.learning_rate * (reward + self.discount_factor * max_next_q - current_q)
        self.q_table[(state, action)] = new_q
        self.exploration_rate *= self.exploration_decay

class TrafficLightSystem:
    def __init__(self, root):
        self.root = root
        self.window = tk.Tk()
        self.window.title("Traffic Light System")
        self.canvas = tk.Canvas(self.window, width=800, height=800, bg="white")
        self.canvas.pack()
        self.cycle_texts = []  # Store texts for all cycles

    def draw_traffic_lights(self, root, x=400, y=50, dx=100):
        if root is None:
            return

        # Draw left subtree
        self.draw_traffic_lights(root.left, x - dx, y + 100, dx // 2)

        # Draw current node
        color = "red" if root.state == "Red" else "green" if root.state == "Green" else "yellow"
        self.canvas.create_rectangle(x - 20, y - 20, x + 20, y + 20, fill=color)
        self.canvas.create_text(x, y + 40, text=f"{root.data}\n{root.traffic_density}%", font=("Arial", 10))

        # Draw right subtree
        self.draw_traffic_lights(root.right, x + dx, y + 100, dx // 2)

    def update_display(self, cycle):
        self.canvas.delete("all")
        self.canvas.create_text(400, 20, text=f"Cycle {cycle}", font=("Arial", 16), fill="blue")
        self.draw_traffic_lights(self.root)
        self.window.update()

    def log_cycle_state(self, root, cycle_log):
        if root is not None:
            self.log_cycle_state(root.left, cycle_log)
            cycle_log.append((root.data, root.state, root.traffic_density))
            self.log_cycle_state(root.right, cycle_log)

    def display_all_cycles(self, logs):
        self.canvas.delete("all")
        y_offset = 50
        for cycle, log in enumerate(logs):
            self.canvas.create_text(400, y_offset, text=f"Cycle {cycle + 1}", font=("Arial", 14), fill="blue")
            y_offset += 20
            for position, state, density in log:
                self.canvas.create_text(400, y_offset, text=f"Position: {position}, State: {state}, Density: {density}%", font=("Arial", 10))
                y_offset += 15
            y_offset += 10
        self.window.update()

    def run_simulation(self, cycles, delay, agent):
        logs = []
        for i in range(cycles):
            print(f"\nCycle {i + 1}:")

            # Optimize traffic light states using Q-learning
            self.optimize_traffic_lights_with_qlearning(self.root, agent)

            # Log the current state
            cycle_log = []
            self.log_cycle_state(self.root, cycle_log)
            logs.append(cycle_log)

            # Update the display for the current cycle
            self.update_display(i + 1)
            self.window.after(int(delay * 1000))

        # Display all cycles at the end
        self.display_all_cycles(logs)

    def optimize_traffic_lights_with_qlearning(self, root, agent):
        if root is None:
            return

        state = (root.state, root.traffic_density)
        action = agent.choose_action(state)

        # Update state based on Q-learning action
        root.state = action

        # Define a reward function (less density and green state gives better reward)
        reward = -root.traffic_density if action != "Green" else -root.traffic_density // 2

        next_state = (root.state, root.traffic_density)
        agent.learn(state, action, reward, next_state)

        self.optimize_traffic_lights_with_qlearning(root.left, agent)
        self.optimize_traffic_lights_with_qlearning(root.right, agent)

def main():
    root = None

    # Create a traffic light system (BST) with random traffic densities
    root = insert_node(root, 50, "Red", random.randint(0, 100))
    root = insert_node(root, 30, "Green", random.randint(0, 100))
    root = insert_node(root, 20, "Yellow", random.randint(0, 100))
    root = insert_node(root, 40, "Red", random.randint(0, 100))
    root = insert_node(root, 70, "Green", random.randint(0, 100))
    root = insert_node(root, 60, "Yellow", random.randint(0, 100))
    root = insert_node(root, 80, "Red", random.randint(0, 100))

    # Display the initial traffic light system
    print("Initial traffic light system:")
    inorder_traversal(root)

    # Initialize traffic light system and Q-learning agent
    traffic_system = TrafficLightSystem(root)
    agent = QLearningAgent()

    # Run the simulation for 5 cycles with a delay of 2 seconds between cycles
    traffic_system.run_simulation(5, 3, agent)

    # Keep the window open
    traffic_system.window.mainloop()

if __name__ == "__main__":
    main()
